## Build iOS
eas build --platform ios --profile production

## Deploy iOS
eas submit --platform ios




## Deploy web prod
npx expo export --platform web
eas deploy --prod

