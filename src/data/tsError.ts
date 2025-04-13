const TS_ERROR_SEVERITY: Record<string, 'low' | 'medium' | 'high'> = {
  TS1005: 'high',
  TS1009: 'high',
  TS1011: 'high',
  TS2300: 'high',
  TS2304: 'high',
  TS2322: 'high',
  TS2329: 'high',
  TS2345: 'high',
  TS2352: 'high',
  TS2362: 'high',
  TS2366: 'high',
  TS2531: 'high',
  TS2532: 'high',
  TS2533: 'high',
  TS2538: 'high',
  TS2551: 'high',
  TS2554: 'high',
  TS2559: 'high',
  TS2564: 'high',
  TS2589: 'high',
  TS2590: 'high',
  TS2604: 'high',
  TS2677: 'high',
  TS2722: 'high',
  TS2739: 'high',
  TS2769: 'high',
  TS2783: 'high',
  TS5074: 'high',
  TS7005: 'high',
  TS7051: 'high',
  TS18046: 'high',
  TS18047: 'high',
  TS18048: 'high',
  TS18049: 'high',
  TS1109: 'medium',
  TS1146: 'medium',
  TS1174: 'medium',
  TS2307: 'medium',
  TS2309: 'medium',
  TS2339: 'medium',
  TS2349: 'medium',
  TS2420: 'medium',
  TS2451: 'medium',
  TS2454: 'medium',
  TS2488: 'medium',
  TS2503: 'medium',
  TS2511: 'medium',
  TS2512: 'medium',
  TS2515: 'medium',
  TS7006: 'medium',
  TS7015: 'medium',
  TS7017: 'medium',
  TS7022: 'medium',
  TS7023: 'medium',
  TS7024: 'medium',
  TS7030: 'medium',
  TS7031: 'medium',
  TS7034: 'medium',
  TS7043: 'medium',
  TS7053: 'medium',
  TS2790: 'low',
  TS2869: 'low',
  TS6133: 'low',
  TS6192: 'low',
  TS6196: 'low',
  TS7027: 'low',
  TS7019: 'low',
  TS80001: 'low',
  TS80002: 'low',
  TS80005: 'low',
  TS80008: 'low',
  TS80009: 'low',
  TS80018: 'low',
  TS80021: 'low',
  TS80026: 'low'
};

function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'TS1005':
      return 'Syntax error, expected a token.';
    case 'TS1009':
      return 'A keyword is missing.';
    case 'TS1011':
      return 'A closing parenthesis is missing.';
    case 'TS1109':
      return 'Unexpected token.';
    case 'TS1146':
      return 'The type definition file could not be found.';
    case 'TS1174':
      return "Argument of type 'x' is not assignable to parameter of type 'y'.";
    case 'TS2300':
      return 'Duplicate identifier.';
    case 'TS2304':
      return 'Cannot find name.';
    case 'TS2307':
      return "Cannot find module 'x' or its corresponding type declarations.";
    case 'TS2309':
      return "Cannot find name 'x'.";
    case 'TS2322':
      return "Type 'x' is not assignable to type 'y'.";
    case 'TS2329':
      return "Property 'x' does not exist on type 'y'.";
    case 'TS2339':
      return "Property 'x' does not exist on type 'y'.";
    case 'TS2345':
      return "Argument of type 'x' is not assignable to parameter of type 'y'.";
    case 'TS2349':
      return "Cannot find module 'x'.";
    case 'TS2352':
      return "Type 'A' cannot be converted to type 'B'.";
    case 'TS2362':
      return "The type of 'x' cannot be inferred.";
    case 'TS2366':
      return 'Wrong call signature.';
    case 'TS2420':
      return "Class 'x' incorrectly implements interface 'y'.";
    case 'TS2451':
      return "Cannot use 'x' as a value because it is a type.";
    case 'TS2454':
      return 'Variable is used before being assigned.';
    case 'TS2464':
      return 'Variable is scope-inaccessible.';
    case 'TS2488':
      return "The name 'x' does not exist in the current scope.";
    case 'TS2503':
      return "Cannot find name 'x' in the current module.";
    case 'TS2511':
      return "Type 'x' is not assignable to type 'y'.";
    case 'TS2512':
      return 'This expression cannot be called as a function.';
    case 'TS2515':
      return "An expression of type 'x' cannot be used as a function.";
    case 'TS2531':
      return "Cannot find name 'x' in module 'y'.";
    case 'TS2532':
    case 'TS2533':
      return "Object is possibly 'null' or 'undefined'.";
    case 'TS2538':
      return "Type 'undefined' cannot be used as an index type.";
    case 'TS2551':
      return "Cannot find name 'x'.";
    case 'TS2554':
      return "Cannot find module 'x'.";
    case 'TS2559':
      return "Cannot find property 'x' of undefined.";
    case 'TS2564':
      return "Cannot find a common property for 'x' and 'y'.";
    case 'TS2589':
    case 'TS2590':
      return 'Expression produces a union type that is too complex to represent.';
    case 'TS2604':
      return "Component missing attribute 'x'.";
    case 'TS2677':
      return "Cannot extend type 'x'.";
    case 'TS2722':
      return "Cannot invoke an object which is possibly 'undefined'.";
    case 'TS2739':
      return "Type 'x' cannot be assigned to type 'y'.";
    case 'TS2769':
      return 'No overload matches this call.';
    case 'TS2783':
      return 'Assertion functions have to return data.';
    case 'TS2786':
      return 'Variance-monitoring type check failed.';
    case 'TS2790':
      return "The operand of a 'delete' operator must be optional.";
    case 'TS2869':
      return 'Right operand of ?? is unreachable because the left operand is never nullish.';
    case 'TS5074':
      return 'Property initialization not allowed in abstract class.';
    case 'TS6133':
      return "Parameter 'x' is declared but never used.";
    case 'TS6192':
      return 'This version of TypeScript requires at least version 2.7 of TypeScript to compile.';
    case 'TS6196':
      return "No 'typeRoots' found for this module.";
    case 'TS7005':
      return "Variable 'x' implicitly has an 'any[]' type.";
    case 'TS7006':
      return "Parameter 'x' implicitly has an 'any' type.";
    case 'TS7015':
      return 'This syntax is only available in TypeScript 3.7 and higher.';
    case 'TS7017':
      return 'Configured type aligns wrongly.';
    case 'TS7019':
      return 'Spread assignments are non-spreadable.';
    case 'TS7022':
      return 'Label is not valid at this location.';
    case 'TS7023':
      return 'Synthetic ts-expect-error match ignored.';
    case 'TS7024':
      return 'Spread of any identical property must match.';
    case 'TS7027':
      return "Cannot find module 'x'.";
    case 'TS7030':
      return "The 'type' keyword cannot be used here.";
    case 'TS7031':
      return 'Missing type declaration.';
    case 'TS7034':
      return "Missing function implementation for 'x'.";
    case 'TS7043':
      return "Could not find a declaration file for module 'x'.";
    case 'TS7051':
      return 'Property mismatch per rule violations.';
    case 'TS7053':
      return "Element implicitly has an 'any' type because expression of type 'x' cannot be used to index type 'y'.";
    case 'TS80001':
      return "Cannot find module 'x'.";
    case 'TS80002':
      return "Type definition not found for module 'x'.";
    case 'TS80005':
      return "Module 'x' is declared but its export is missing.";
    case 'TS80008':
      return "Module 'x' cannot be imported because it's not installed.";
    case 'TS80009':
      return "Cannot find module 'x'.";
    case 'TS80018':
      return "Type definitions are missing for module 'x'.";
    case 'TS80021':
      return "Cannot find module 'x'.";
    case 'TS80026':
      return "Type 'x' is not assignable to type 'y'.";
    case 'TS18046':
      return "Element implicitly has an 'any' type because of absence of index signatures.";
    case 'TS18047':
    case 'TS18048':
    case 'TS18049':
      return "'x' is possibly 'null'/'undefined'.";
    default:
      return 'Unknown error code.';
  }
}

export function getSeverity(code: string): string {
  const severity = TS_ERROR_SEVERITY[code] || 'unknown';
  const message = getErrorMessage(code);

  switch (severity) {
    case 'high':
      return `🔴 High: ${message}`;
    case 'medium':
      return `🟠 Medium: ${message}`;
    case 'low':
      return `🟢 Low: ${message}`;
    default:
      return `🟡 Unknown: ${message}`;
  }
}
