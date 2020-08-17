import edu.mit.csail.sdg.alloy4.A4Reporter;
import edu.mit.csail.sdg.alloy4.ErrorWarning;
import edu.mit.csail.sdg.parser.CompUtil;
import edu.mit.csail.sdg.translator.A4Options;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.TranslateAlloyToKodkod;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import tsdolly.Program;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

@Command(description = "Generates solutions in JSON format for an Alloy model and command.",
        name = "generate", mixinStandardHelpOptions = true)
public class Generate implements Callable<Integer> {
    @Option(names = {"-c", "--command"}, description = "Alloy command to run", defaultValue = "default")
    private String command;

    @Option(names = {"-m", "--model"}, description = "Alloy model file", defaultValue = "../typescript.als")
    private File alloyTheory;

    @Option(names = {"-o", "--output"}, description = "Output file", defaultValue = "../output/alloySolutions.json")
    private File outputPath;

    @Option(names = {"--count"}, description = "Count solutions")
    private boolean count;

    class SolRef {
        public A4Solution solutionRef;
    }

    private static void writeAllSolutions(A4Solution solution, OutputStreamWriter writer) throws IOException {
        int solutionsCount = 0;
        writer.write("[\n");
        while (solution.satisfiable()) {
            var p = new Program(solution);
            var solutionJson = p.toJson();
            if (solutionsCount > 0) {
                writer.write(",\n");
            }
            System.out.printf("Writing solution %d...%n", solutionsCount);
            writer.write(solutionJson.toString());
            solution = solution.next();
            solutionsCount += 1;
        }
        writer.write("\n]");
        System.out.printf("Total solutions: %d%n", solutionsCount);
    }

    private static int countSolutions(SolRef solutionRef) {
        A4Solution solution = solutionRef.solutionRef;
        solutionRef.solutionRef = null;
        int count = 0;
        while (solution.satisfiable()) {
            if ((count % 1000) == 0) {
                System.out.printf("Solution %d%n", count);
            }
            count += 1;
            solution = solution.next();
        }
        return count;
    }

    private static A4Reporter createA4Reporter() { // TODO: review this
        return new A4Reporter() {
            @Override
            public void warning(ErrorWarning msg) {
                System.out.print("Relevance Warning:\n"
                        + (msg.toString().trim()) + "\n\n");
                System.out.flush();
            }
        };
    }

    public Integer call() throws IOException {
        var reporter = createA4Reporter();
        var metamodel = CompUtil.parseEverything_fromFile(reporter, null, this.alloyTheory.getPath());

        var sigs = metamodel.getAllReachableSigs();
        var commands = metamodel.getAllCommands();

        var cmds = commands.stream().filter(c -> c.label.equalsIgnoreCase(this.command)).findFirst();
        if (cmds.isEmpty()) {
            throw new IllegalArgumentException(String.format("Command '%s' not found. Commands available:\n%s",
                    this.command,
                    commands.stream().map(c -> "'" + c.label + "'").collect(Collectors.joining("\n\t", "\t", ""))));
        }
        var cmd = cmds.get();
        var options = new A4Options();
        options.solver = A4Options.SatSolver.MiniSatJNI;

        System.out.printf("Running command '%s'%n", cmd.label);
        if (this.count) {
            System.out.println("Counting solutions...");
            var solutionRef = new SolRef();
            solutionRef.solutionRef = TranslateAlloyToKodkod.execute_command(reporter, sigs, cmd, options);
            System.out.printf("Total solutions: %d%n", countSolutions(solutionRef));
        }
        else {
            var solution = TranslateAlloyToKodkod.execute_command(reporter, sigs, cmd, options);
            try (OutputStreamWriter writer =
                         new OutputStreamWriter(new BufferedOutputStream(new FileOutputStream(this.outputPath)),
                                 StandardCharsets.UTF_8)) {
                writeAllSolutions(solution, writer);
            }
        }
        return 0;
    }
}
