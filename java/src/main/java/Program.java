import java.util.List;
import java.util.Map;
import java.util.Objects;

public class Program {
    private class SigInstance {
        final String sig;
        final String id;

        private SigInstance(String sig, String id) {
            this.sig = sig;
            this.id = id;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            SigInstance that = (SigInstance) o;
            return Objects.equals(sig, that.sig) &&
                    Objects.equals(id, that.id);
        }

        @Override
        public int hashCode() {
            return Objects.hash(sig, id);
        }
    }

    private Map<String, List<SigInstance>> objects;
    private Map<String, List<String>> fields;
    private Map<String, Map<SigInstance, SigInstance>> relations;
}
