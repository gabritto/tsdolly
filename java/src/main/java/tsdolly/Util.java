package tsdolly;
import edu.mit.csail.sdg.ast.Sig;
import edu.mit.csail.sdg.translator.A4Tuple;
import tsdolly.Pair;

public class Util {
    static public String sigName(Sig sig) {
        return sig.label;
    }

    static public String sigInstanceId(A4Tuple instance) {
        return instance.toString(); // TODO: parse; validate
    }

    static public String fieldName(Sig.Field field) {
        return field.label;
    }
    static public Pair<String, String> fieldEntry(A4Tuple entry) { // TODO: parse; assert tuple
        System.out.println("Field entry:\n" + entry.toString());
        var elements = entry.toString().split("->");
        return new Pair(elements[0], elements[1]);
    }
}