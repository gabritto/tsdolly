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

    @Option(names = {"-m", "--model"}, description = "Alloy model file", defaultValue = "../../typescript.als")
    private File alloyTheory;

    @Option(names = {"-o", "--output"}, description = "Output file", defaultValue = "../solutions/solutions.json")
    private File outputPath;

    @Option(names = {"--count"}, description = "Count solutions")
    private boolean count;

    @Option(names = {"--solver"}, description = "SAT solver to be used in Alloy API. Valid values: " +
            "${COMPLETION-CANDIDATES}", defaultValue = "SAT4J")
    private Solver solver;

    private enum Solver {
        MiniSat,
        SAT4J
    }

    static class SolutionWrapper {
        private A4Solution solution;
        public A4Solution getSolution() throws Exception {
            if (this.solution == null) {
                throw new Exception("A solution in a wrapper can only be used once and this solution has already been" +
                        " " +
                        "used.");
            }
            var solution = this.solution;
            this.solution = null;
            return solution;
        }

        SolutionWrapper(A4Solution solution) {
            if (solution == null) {
                throw new IllegalArgumentException("Cannot create a solution wrapper from a null solution.");
            }
            this.solution = solution;
        }
    }

    private static void writeAllSolutions(SolutionWrapper solutionWrapper, OutputStreamWriter writer) throws Exception {
        var solution = solutionWrapper.getSolution();
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

    private static int countSolutions(SolutionWrapper solutionWrapper) throws Exception {
        var solution = solutionWrapper.getSolution();
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

    private static A4Reporter createA4Reporter() {
        return new A4Reporter() {
            @Override
            public void warning(ErrorWarning msg) {
                System.out.print("Relevance Warning:\n"
                        + (msg.toString().trim()) + "\n\n");
                System.out.flush();
            }
        };
    }

    public Integer call() throws Exception {
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
        options.solver = null;
        switch (this.solver) {
            case SAT4J:
                options.solver = A4Options.SatSolver.SAT4J;
                break;
            case MiniSat:
                options.solver = A4Options.SatSolver.MiniSatJNI;
                break;
        }

        System.out.printf("Running command '%s'%n", cmd.label);
        var solutionWrapper = new SolutionWrapper(TranslateAlloyToKodkod.execute_command(reporter, sigs, cmd, options));
        if (this.count) {
            System.out.println("Counting solutions...");
            System.out.printf("Total solutions: %d%n", countSolutions(solutionWrapper));
        }
        else {
            try (OutputStreamWriter writer =
                         new OutputStreamWriter(new BufferedOutputStream(new FileOutputStream(this.outputPath)),
                                 StandardCharsets.UTF_8)) {
                writeAllSolutions(solutionWrapper, writer);
            }
        }
        return 0;
    }
}
