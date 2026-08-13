# NutriHub — Mobile (paciente)

App do paciente, feito em Expo/React Native. Não entra no `docker-compose.yml` — Expo roda no host (Metro bundler + simulador/dispositivo), containerizar não traz benefício em dev.

Login/cadastro do paciente é feito pelo profissional (tela do paciente no painel web,
"Acesso ao app") — o app aqui só consome `/patient-auth/login` e `/patient-portal/*`.

```bash
pnpm install
npx expo start
```

Por padrão o app tenta descobrir o IP da máquina rodando a API a partir do host do
Metro bundler (funciona em dispositivo físico na mesma rede Wi-Fi). Pra apontar
explicitamente pra API (ex: emulador Android, que não resolve `localhost` do host
automaticamente), setar antes de rodar:

```bash
EXPO_PUBLIC_API_URL=http://SEU_IP_OU_10.0.2.2:8000 npx expo start
```

**Nota pnpm + Expo**: o `package.json` usa `"main": "index.js"` (não
`node_modules/expo/AppEntry.js`, o default do template Expo) porque esse caminho
relativo quebra sob a estrutura de node_modules do pnpm (`.pnpm/expo@.../node_modules/expo/../../App`
aponta pro lugar errado). `index.js` na raiz do pacote resolve isso.

## Publicação nas lojas

Build gerenciado via [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --platform ios
npx eas build --platform android
npx eas submit
```

Atualizações de JS sem passar por novo review de loja: [EAS Update](https://docs.expo.dev/eas-update/introduction/).
