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

    + Test Skip 25:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/convertToTemplateString.json --result=../experiments/logs/convertToTemplateString25.json --refactoring="Convert to template string" --skip=25 --performance=../experiments/logs/perf_convertToTemplateString25.json
        ```
    + Test Skip 10:

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