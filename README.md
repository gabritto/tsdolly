# TSDolly
TSDolly is a tool for automatically generating TypeScript programs using [Alloy](https://alloytools.org/).
The generated programs can be used to test the implementation of refactorings.  
TSDolly is based on [JDolly](https://github.com/gustavoasoares/jdolly), which generates Java programs.

This work is part of a bachelor's thesis.


## TODO/Questions list
 - [ ] Update README with more details.
 - [ ] Unify build.
 - [ ] Add instructions on how to build.
 - [ ] Unify run (Java + TS).
 - [ ] Add instructions on how to run.
 - [ ] Add instructions on how to contribute.
 - [ ] Add license? (Must check libraries' licenses (guava, alloy, gson))
 - [ ] Add CLI to Java code with command options.
 - [ ] Edit `run` commands' scopes to be inclusive instead of using a default scope + exclusions
    (e.g. `run foo for 1 Class, 2 ParameterDecl`)
 - [ ] Add CLI option to Java for manipulating scope?
 - [ ] Add ESLint?