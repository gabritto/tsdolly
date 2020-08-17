package tsdolly;

import com.google.gson.JsonArray;
import com.google.gson.JsonPrimitive;
import edu.mit.csail.sdg.ast.ExprUnary;
import edu.mit.csail.sdg.ast.Sig;
import edu.mit.csail.sdg.ast.Sig.Field;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.A4Tuple;

import java.util.*;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
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

    private class Id {
        public final String id;
        public Id(String id) {
            this.id = id;
        }

        public JsonElement toJson() {
            return new JsonPrimitive(this.id);
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

    private final Multimap<Sig, Id> sigToObjects; // Maps a sig to its instances
    private final Map<Id, Sig> objectToSig;
    private final Multimap<Sig, Field> sigFields; // Maps a sig to its fields
    private final Map<Field, Multimap<Id, Id>> relations; // Maps a relation (field) to its members
    private final Id programId;

    public Program(A4Solution solution) {
        assert solution.satisfiable() : solution;
        this.sigToObjects = HashMultimap.create();
        this.objectToSig = new HashMap<>();
        this.sigFields = HashMultimap.create();
        this.relations = new HashMap<>();
        for (Sig sig : solution.getAllReachableSigs()) {
            for (final A4Tuple sigTuple : solution.eval(sig)) {
                final var instanceId = new Id(Util.sigInstanceId(sigTuple));
                if (this.objectToSig.containsKey(instanceId)) {
                    var otherSig = this.objectToSig.get(instanceId);
                    if (sig.isSameOrDescendentOf(otherSig)) { // We want the most specific sig possible for an object.
                        this.objectToSig.put(instanceId, sig);
                    }
                }
                else {
                    this.objectToSig.put(instanceId, sig);
                }
                this.sigToObjects.put(sig, instanceId);
            }

            for (Field field: sig.getFields()) {
                this.sigFields.put(sig, field);
            }
        }

        for (Field field: this.sigFields.values()) {
            final Multimap<Id, Id> fieldMap = HashMultimap.create();
            for (final A4Tuple fieldTuple : solution.eval(field)) {
                final var instanceNames = Util.fieldEntry(fieldTuple);
                fieldMap.put(new Id(instanceNames.fst), new Id(instanceNames.snd));
            }
            this.relations.put(field, fieldMap);
        }

        Sig programSig = Util.getProgramSig(solution.getAllReachableSigs());
        var programs = this.sigToObjects.get(programSig);
        if (programs == null || programs.size() != 1) {
            final int programCount = programs == null ? 0 : programs.size();
            throw new IllegalArgumentException("Expected solution to have a single instance of type `Program`," +
                " instead found " + programCount);
        }
        this.programId = programs.iterator().next();
    }

    public JsonElement toJson() {
        var programSig = this.objectToSig.get(this.programId);
        return parseObject(programSig, this.programId);
    }

    public JsonElement parseObject(Sig sig, Id objectId) { // TODO: implement cycle detection? Otherwise will have a stack overflow
        var json = new JsonObject();

        json.add(Util.ID_FIELD, objectId.toJson());
        json.add(Util.TYPE_FIELD, Util.sigToJson(sig));
        var fields = this.sigFields.get(sig);
        for (Field field: fields) {
            var members = this.relations.get(field).get(objectId);
            var mult = field.decl().expr.mult();
            if (mult.equals(ExprUnary.Op.SETOF)) {
                var membersJson = new JsonArray();
                for (Id memberId : members) {
                    var memberSig = this.objectToSig.get(memberId);
                    var memberJson = parseObject(memberSig, memberId);
                    membersJson.add(memberJson);
                }
                json.add(Util.fieldName(field), membersJson);
            }
            else if (members.iterator().hasNext()) {
                Id memberId = members.iterator().next();
                var memberSig = this.objectToSig.get(memberId);
                var memberJson = parseObject(memberSig, memberId);
                json.add(Util.fieldName(field), memberJson);
            }
        }
        return json;
    }
}
