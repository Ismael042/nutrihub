import { registerRootComponent } from "expo";

import App from "./App";

// Não usa "node_modules/expo/AppEntry.js" como entrypoint (default do template Expo)
// porque esse arquivo resolve "../../App" por caminho relativo, assumindo node_modules
// hoisted "achatado" (npm/yarn). Sob pnpm, `expo` fica dentro de
// node_modules/.pnpm/expo@.../node_modules/expo/, então esse caminho relativo aponta
// pro lugar errado e o Metro falha com "Unable to resolve module ../../App". Um
// entrypoint próprio no root do pacote evita esse problema.
registerRootComponent(App);
