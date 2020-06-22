package tsdolly;
import com.google.gson.JsonPrimitive;
import edu.mit.csail.sdg.ast.Sig;
import edu.mit.csail.sdg.translator.A4Tuple;

import java.util.Collection;

public class Util {
    static public final String ID_FIELD = "id";
    static public final String TYPE_FIELD = "type";

    static public String sigName(Sig sig) {
        return sig.label;
    }

    static public JsonPrimitive sigToJson(Sig sig) {
        return new JsonPrimitive(sigName(sig));
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
        return new Pair<>(elements[0], elements[1]);
    }

    static public Sig getProgramSig(Iterable<Sig> sigs) {
        for (final Sig sig : sigs) {
            if (sigName(sig).equals(PROGRAM_SIG)) {
                return sig;
            }
        }

        throw new IllegalArgumentException("Argument does not contain `Program` sig");
    }

    static private final String PROGRAM_SIG = "Program";
}