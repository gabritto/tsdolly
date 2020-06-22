package tsdolly;

import edu.mit.csail.sdg.ast.Sig;
import edu.mit.csail.sdg.ast.Sig.Field;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.A4Tuple;

import java.util.*;
import tsdolly.Util;
import com.google.common.collect.Multimap;
import com.google.common.collect.HashMultimap;

public class Program {
    @Override
    public String toString() {
        return "Program{" +
                "sigToObjects=" + sigToObjects +
                ", objectToSig=" + objectToSig +
                ", sigFields=" + sigFields +
                ", relations=" + relations +
                '}';
    }
//    private class SigInstance {
//        final String sig;
//        final String id;
//
//        private SigInstance(String sig, String id) {
//            this.sig = sig;
//            this.id = id;
//        }
//
//        public SigInstance(String sig, A4Tuple sigInstance) {
//            this(sig, sigInstance.toString()); // TODO: prettify instance name
//        }
//
//        @Override
//        public boolean equals(Object o) {
//            if (this == o) return true;
//            if (o == null || getClass() != o.getClass()) return false;
//            SigInstance that = (SigInstance) o;
//            return Objects.equals(sig, that.sig) &&
//                    Objects.equals(id, that.id);
//        }
//
//        @Override
//        public int hashCode() {
//            return Objects.hash(sig, id);
//        }
//    }

    private class Id {
        public final String id;
        public Id(String id) {
            this.id = id;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Id id1 = (Id) o;
            return Objects.equals(id, id1.id);
        }

        @Override
        public int hashCode() {
            return Objects.hash(id);
        }

        @Override
        public String toString() {
            return "Id@" + id;
        }
    }

    private final Multimap<Sig, Id> sigToObjects; // Maps a sig name to its instances
    private final Map<Id, Sig> objectToSig;
    private final Multimap<Sig, Field> sigFields; // Maps a sig name to its fields
    private final Map<Field, Multimap<Id, Id>> relations; // Maps a relation (field) to its members

    public Program(A4Solution solution) {
        assert solution.satisfiable() : solution;
        this.sigToObjects = HashMultimap.create();
        this.objectToSig = new HashMap<>();
        this.sigFields = HashMultimap.create();
        this.relations = new HashMap<>();
        for (Sig sig: solution.getAllReachableSigs()) { // TODO: filter by user-defined sigs.
            for (Iterator<A4Tuple> sigTuples = solution.eval(sig).iterator(); sigTuples.hasNext(); ) {
                A4Tuple sigTuple = sigTuples.next();
                final var instanceId = new Id(Util.sigInstanceId(sigTuple));
                assert !this.objectToSig.containsKey(instanceId);
                this.objectToSig.put(instanceId, sig);
                this.sigToObjects.put(sig, instanceId);
            }

            for (Field field: sig.getFields()) {
                this.sigFields.put(sig, field);
            }
        }

        for (Field field: this.sigFields.values()) {
            final Multimap<Id, Id> fieldMap = HashMultimap.create();
            for (Iterator<A4Tuple> fieldTuples = solution.eval(field).iterator(); fieldTuples.hasNext(); ) {
                final var fieldTuple = fieldTuples.next();
                final var instanceNames = Util.fieldEntry(fieldTuple);
                fieldMap.put(new Id(instanceNames.fst), new Id(instanceNames.snd));
            }
            this.relations.put(field, fieldMap);
        }
    }

}
