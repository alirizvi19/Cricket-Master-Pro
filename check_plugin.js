import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
console.log(Object.keys(firebaseRulesPlugin.configs));
console.log(typeof firebaseRulesPlugin.configs['flat/recommended']);
