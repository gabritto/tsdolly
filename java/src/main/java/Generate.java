import com.google.gson.JsonArray;
import edu.mit.csail.sdg.alloy4.A4Reporter;
import edu.mit.csail.sdg.alloy4.ErrorWarning;
import edu.mit.csail.sdg.parser.CompUtil;
import edu.mit.csail.sdg.translator.A4Options;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.TranslateAlloyToKodkod;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import tsdolly.Program;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

@Command(description = "Generates solutions in JSON format for an Alloy model and command.",
        name = "generate", mixinStandardHelpOptions = true)
public class Generate implements Callable<Integer> {
    @Option(names = {"-c", "--command"}, description = "alloy command to run", defaultValue = "default")
    private String command;

    @Option(names = {"-m", "--model"}, description = "alloy model file", defaultValue = "../typescript.als")
    private File alloyTheory;

    @Option(names = {"-o", "--output"}, description = "output file", defaultValue = "../output/alloySolutions.json")
    private File outputPath;

    private static JsonArray getAllSolutions(A4Solution solution) {
        var solutionsJson = new JsonArray();
        while (solution.satisfiable()) {
            var p = new Program(solution);
            solutionsJson.add(p.toJson());
            solution = solution.next();
        }
        return solutionsJson;
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

        System.out.println(String.format("Running command '%s'", cmd.label));
        var solution = TranslateAlloyToKodkod.execute_command(reporter, sigs, cmd, options);
        var solutionsJson = getAllSolutions(solution);
        try (OutputStreamWriter writer =
                     new OutputStreamWriter(new FileOutputStream(this.outputPath), StandardCharsets.UTF_8)) {
            System.out.println(String.format("Writing %d solutions", solutionsJson.size()));
            writer.write(solutionsJson.toString());
        }
        return 0;
    }
}
