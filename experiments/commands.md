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
        Total programs that compile: 4748
        Compiling rate: 99.16457811194654%
        Programs that can be refactored (refactorable): 4788
        Refactorable rate: 100%

        Results written to ../experiments/logs/convertToTemplateString50.json
        Performance entries appended to ../experiments/logs/perf_convertToTemplateString50.json

        real    359m1.782s
        user    411m42.859s
        sys     35m13.672s

    + Test Skip 25:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/convertToTemplateString.json --result=../experiments/logs/convertToTemplateString25.json --refactoring="Convert to template string" --skip=25 --performance=../experiments/logs/perf_convertToTemplateString25.json
        ```
        Total programs: 239399  
        Total programs sampled and analyzed: 9576  
        Total programs that compile: 9491  
        Compiling rate: 99.11236424394319%  
        Programs that can be refactored (refactorable): 9576  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/convertToTemplateString25.json  
        Performance entries appended to ../experiments/logs/perf_convertToTemplateString25.json  

        real    739m5.106s  
        user    840m27.219s  
        sys     69m39.594s  

- Extract Symbol:

    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/extractSymbol.json --command=ExtractSymbol --solver=MiniSat"
        ```
        Total solutions: 406096
        real    6m38.021s  
        user    0m1.344s  
        sys     0m0.438s 
 
    + Test Skip 50:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/extractSymbol.json --result=../experiments/logs/extractSymbol50.json --refactoring="Extract Symbol" --skip=50 --performance=../experiments/logs/perf_extractSymbol50.json
        ```
        Total programs: 406096  
        Total programs sampled and analyzed: 8122  
        Total programs that compile: 7935  
        Compiling rate: 97.6976114257572%  
        Programs that can be refactored (refactorable): 8122  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/extractSymbol50.json  
        Performance entries appended to ../experiments/logs/perf_extractSymbol50.json  

        real    1767m33.366s  
        user    2049m46.063s  
        sys     279m41.172s  
    
    + Test Skip 25:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/extractSymbol.json --result=../experiments/logs/extractSymbol25.json --refactoring="Extract Symbol" --skip=25 --performance=../experiments/logs/perf_extractSymbol25.json
        ```
        Total programs sampled and analyzed: 16244
        Total programs that compile: 15854
        Compiling rate: 97.59911351883773%
        Programs that can be refactored (refactorable): 16244
        Refactorable rate: 100%

        Results written to ../experiments/logs/extractSymbol25.json
        Performance entries appended to ../experiments/logs/perf_extractSymbol25.json

        real    3572m26.576s
        user    4144m10.375s
        sys     477m12.125s

- Generate 'get' and 'set' accessors:

    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/generateGetAndSetAccessors.json --command=GenerateGetAndSetAccessors --solver=MiniSat"
        ```
        Total solutions: 546968  
        real    9m57.313s  
        user    0m2.250s  
        sys     0m0.438s

    + Test Skip 50:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/generateGetAndSetAccessors.json --result=../experiments/logs/generateGetAndSetAccessors50.json --refactoring="Generate 'get' and 'set' accessors" --skip=50 --performance=../experiments/logs/perf_generateGetAndSetAccessors50.json
        ```
        Total programs: 546968  
        Total programs sampled and analyzed: 10939  
        Total programs that compile: 10660  
        Compiling rate: 97.44949264100923%  
        Programs that can be refactored (refactorable): 10939  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/generateGetAndSetAccessors50.json
        Performance entries appended to ../experiments/logs/perf_generateGetAndSetAccessors50.json

        real    816m33.599s  
        user    961m2.438s  
        sys     127m52.406s  

    + Test Skip 25:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/generateGetAndSetAccessors.json --result=../experiments/logs/generateGetAndSetAccessors25.json --refactoring="Generate 'get' and 'set' accessors" --skip=25 --performance=../experiments/logs/perf_generateGetAndSetAccessors25.json
        ```
        Total programs: 546968  
        Total programs sampled and analyzed: 21879  
        Total programs that compile: 21342  
        Compiling rate: 97.54559166323872%  
        Programs that can be refactored (refactorable): 21879  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/generateGetAndSetAccessors25.json  
        Performance entries appended to ../experiments/logs/perf_generateGetAndSetAccessors25.json  

        real    1970m55.198s  
        user    2274m55.422s  
        sys     239m53.594s  

- Move to a new file:

    + Generate
        ```sh
        time ./gradlew run --args="--output=../../experiments/solutions/moveToNewFile.json --command=MoveToNewFile --solver=MiniSat"
        ```
        Total solutions: 499038  
        real    11m31.593s  
        user    0m2.344s  
        sys     0m0.547s  
    
    + Test Skip 50:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/moveToNewFile.json --result=../experiments/logs/moveToNewFile50.json --refactoring="Move to a new file" --skip=50 --performance=../experiments/logs/perf_moveToNewFile50.json
        ```
        Total programs: 499038  
        Total programs sampled and analyzed: 9981  
        Total programs that compile: 9755  
        Compiling rate: 97.73569782586915%  
        Programs that can be refactored (refactorable): 9981  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/moveToNewFile50.json  
        Performance entries appended to ../experiments/logs/perf_moveToNewFile50.json  

        real    892m54.385s  
        user    1028m34.844s  
        sys     109m17.266s  

    + Test Skip 25:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/moveToNewFile.json --result=../experiments/logs/moveToNewFile25.json --refactoring="Move to a new file" --skip=25 --performance=../experiments/logs/perf_moveToNewFile25.json
        ```
        Total programs: 499038  
        Total programs sampled and analyzed: 19962  
        Total programs that compile: 19522  
        Compiling rate: 97.79581204288148%  
        Programs that can be refactored (refactorable): 19962  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/moveToNewFile25.json  
        Performance entries appended to ../experiments/logs/perf_moveToNewFile25.json  

        real    1852m27.978s  
        user    2132m7.641s  
        sys     218m37.797s  

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
        time node typescript/dist/process.js --solution=../experiments/solutions/convertParams.json --result=../experiments/logs/convertParams50.json --refactoring="Convert parameters to destructured object" --skip=50 --performance=../experiments/logs/perf_convertParams50.json
        ```
        Total programs: 315310
        Total programs sampled and analyzed: 6306
        Total programs that compile: 6183
        Compiling rate: 98.04947668886774%
        Programs that can be refactored (refactorable): 6306
        Refactorable rate: 100%

        Results written to ../experiments/logs/convertParams50.json
        Performance entries appended to ../experiments/logs/perf_convertParams50.json

        real    493m23.515s
        user    566m34.391s
        sys     51m25.531s

    + Test Skip 25:
        ```sh
        time node typescript/dist/process.js --solution=../experiments/solutions/convertParams.json --result=../experiments/logs/convertParams25.json --refactoring="Convert parameters to destructured object" --skip=25 --performance=../experiments/logs/perf_convertParams25.json
        ```
        Total programs: 315310  
        Total programs sampled and analyzed: 12612  
        Total programs that compile: 12379  
        Compiling rate: 98.15255312400888%  
        Programs that can be refactored (refactorable): 12612  
        Refactorable rate: 100%  

        Results written to ../experiments/logs/convertParams25.json  
        Performance entries appended to ../experiments/logs/perf_convertParams25.json  

        real    1010m30.120s  
        user    1153m52.422s  
        sys     100m47.219s  