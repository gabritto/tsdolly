package tsdolly;
import com.google.gson.JsonPrimitive;
import edu.mit.csail.sdg.ast.Sig;
import edu.mit.csail.sdg.translator.A4Tuple;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Util {
    static public final String ID_FIELD = "id";
    static public final String TYPE_FIELD = "type";

    static public String sigName(Sig sig) {
        Matcher matcher = SIG_PATTERN.matcher(sig.label);
        if (matcher.matches()) {
            return matcher.group(1);
        }
        return sig.label;
    }

    static private final Pattern SIG_PATTERN = Pattern.compile("this/(\\S+)");

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
            System.out.println("Sig name: " + sigName(sig));
            if (sigName(sig).equals(PROGRAM_SIG)) {
                return sig;
            }
        }

        throw new IllegalArgumentException("Argument does not contain `Program` sig");
    }

    static private final String PROGRAM_SIG = "Program";
}