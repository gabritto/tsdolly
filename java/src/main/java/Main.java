import com.google.gson.JsonArray;

import java.io.*;
import java.nio.charset.StandardCharsets;

import edu.mit.csail.sdg.translator.A4Options;
import edu.mit.csail.sdg.parser.CompUtil;
import edu.mit.csail.sdg.alloy4.A4Reporter;
import edu.mit.csail.sdg.alloy4.ErrorWarning;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.TranslateAlloyToKodkod;
import tsdolly.Program;

public class Main {
    static private String alloyTheory = "../typescript.als";
    static private String outputPath = "../output/alloySolutions.json";

    public static void main(String[] args) throws IOException {
        System.out.println("Starting main...");

        var reporter = createA4Reporter();
        var metamodel = CompUtil.parseEverything_fromFile(reporter, null, alloyTheory);
//      System.out.println(metamodel.toString());

        var sigs = metamodel.getAllReachableSigs();
//        System.out.println(sigs.toString());
        var commands = metamodel.getAllCommands();
        var options = new A4Options();
        var cmd = commands.get(0); // TODO: add option to filter commands
        System.out.println(String.format("Running command %s:", cmd.toString()));
        var solution = TranslateAlloyToKodkod.execute_command(reporter, sigs, cmd, options);
        var solutionsJson = getAllSolutions(solution);
        try (OutputStreamWriter writer =
                     new OutputStreamWriter(new FileOutputStream(outputPath), StandardCharsets.UTF_8)) {
            writer.write(solutionsJson.toString());
        }

        System.out.println("Ending main");
    }

    private static JsonArray getAllSolutions(A4Solution solution) {
        var solutionsJson = new JsonArray();
        while (solution.satisfiable()) {
            var p = new Program(solution);
            solutionsJson.add(p.toJson());
//            System.out.println("Program as json:\n" + p.toJson().toString());
            solution = solution.next();
        }
        return solutionsJson;
    }

//    private static Sig findSig(A4Solution solution) {
//        var sigs = solution.getAllReachableSigs();
//        for (Sig sig: sigs) {
////            System.out.println("Sig label:\n" + sig.label);
////            System.out.println("Sig fields:\n" + sig.getFields().toString());
//            for (var field: sig.getFields()) {
////                System.out.println("Sig field:\n" + field.label);
////                System.out.println("Fields eval:\n" + solution.eval(field));
//            }
//            if (sig.label.equals("this/FunctionDecl")) {
//                return sig;
//            }
//        }
//        return null;
//    }

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
}
