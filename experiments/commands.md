# Commands for experiments

- Convert to template string:

    + Generate:
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/convertToTemplateString.json --command=ConvertToTemplateString --solver=MiniSat"
        ```
        Total solutions: 239399  
        real    3m7.475s  
        user    0m1.438s  
        sys     0m0.516s  

    + Test Skip 50:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/convertToTemplateString.json --result=../experiments/logs/convertToTemplateString50.json --refactoring="Convert to template string" --skip=50 --performance=../experiments/logs/perf_convertToTemplateString50.json
        ```
        Total programs: 239399  
        Total programs sampled and analyzed: 4788  
        Total programs that compile: 4757  
        Compiling rate: 99.35254803675856%  
        Programs that can be refactored (refactorable): 4788  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/convertToTemplateString50.json
        Performance entries appended to ../experiments/logs/perf_convertToTemplateString50.json  

        time  
        real    222m27.548s  
        user    263m40.172s  
        sys     40m53.266s  

        Average time per program: 2.8 seconds

    + Test Skip 25:

- Extract Symbol:

    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/extractSymbol.json --command=ExtractSymbol --solver=MiniSat"
        ```
        Total solutions: 406096
        real    6m38.021s  
        user    0m1.344s  
        sys     0m0.438s  


- Generate 'get' and 'set' accessors:
    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/generateGetAndSetAccessors.json --command=GenerateGetAndSetAccessors --solver=MiniSat"
        ```
        Total solutions: 546968  
        real    9m57.313s  
        user    0m2.250s  
        sys     0m0.438s  


- Move to a new file:
    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/moveToNewFile.json --command=MoveToNewFile --solver=MiniSat"
        ```
        Total solutions: 499038  
        real    11m31.593s  
        user    0m2.344s  
        sys     0m0.547s  

- Convert parameters to destructured object:
    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/convertParams.json --command=ConvertParamsToDestructuredObject --solver=MiniSat"
        ```
        Total solutions: 315310  
        real    4m25.884s  
        user    0m1.391s  
        sys     0m0.453s  
    + Test Skip 50:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/convertParams.json --result=../experiments/logs/convertParams50.json --refactoring="Convert parameters to destructured object" --skip=50 --performance=../experiments/logs/perf_convertParams50.jsonPerformance entries appended to ../experiments/logs/perf_convertParams50.json
        ```
        Total programs: 315310  
        Total programs sampled and analyzed: 6306  
        Total programs that compile: 6177  
        Compiling rate: 97.95432921027593%  
        Programs that can be refactored (refactorable): 6306  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/convertParams50.json
        Performance entries appended to ../experiments/logs/perf_convertParams50.json

        real    316m19.076s  
        user    373m13.672s  
        sys     58m17.703s  