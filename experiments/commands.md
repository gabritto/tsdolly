- Extract symbol:
    + Skip 25:
```sh
node typescript/dist/main.js generate --output=solutions/exp/extractSymbol.json --result=logs/exp/extractSymbol25.json --solver=MiniSat --refactoring="Extract Symbol" --skip=25 --command=ExtractSymbol
```
    + Skip 10:
```sh
node typescript/dist/process.js --solution=solutions/exp/extractSymbol.json --result=logs/exp/extractSymbol10.json --solver=MiniSat --refactoring="Extract Symbol" --skip=10 --command=ExtractSymbol
```