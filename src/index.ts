import { noNestedJSXReturn } from "./rules/no-nested-jsx-return";
import { explicitObjectTypes } from "./rules/explicit-object-types";
import { sortKeysFixable } from "./rules/sort-keys-fixable";
import { noTransitionCSSProperties } from "./rules/no-transition-cssproperties";
import { noExplicitReturnTypes } from "./rules/no-explicit-return-types";
import { maxJSXNesting } from "./rules/max-jsx-nesting";
import { seperateStyleFiles } from "./rules/seperate-style-files";
import { noUnnecessaryKey } from "./rules/no-unnecessary-key";
import { sortExports } from "./rules/sort-exports";
import { localizeReactProps } from "./rules/localize-react-props";
import { noOrNoneComponent } from "./rules/no-or-none-component";
import { noButtonNavigation } from "./rules/no-button-navigation";
import { noMultiStyleObjects } from "./rules/no-multi-style-objects";
import { noUselessFunction } from "./rules/no-useless-function";
import { minVarLength } from "./rules/min-var-length";
import { maxDepthExtended } from "./rules/max-depth-extended";
import { springNamingConvention } from "./rules/spring-naming-convention";
import { inlineStyleLimit } from "./rules/inline-style-limit";
import { noInlinePropTypes } from "./rules/no-inline-prop-types";
import { noUnnecessaryDiv } from "./rules/no-unnecessary-div";

export default {
	rules: {
		"no-nested-jsx-return": noNestedJSXReturn,
		"explicit-object-types": explicitObjectTypes,
		"sort-keys-fixable": sortKeysFixable,
		"no-transition-cssproperties": noTransitionCSSProperties,
		"no-explicit-return-type": noExplicitReturnTypes,
		"max-jsxnesting": maxJSXNesting,
		"seperate-style-files": seperateStyleFiles,
		"no-unnecessary-key": noUnnecessaryKey,
		"sort-exports": sortExports,
		"localize-react-props": localizeReactProps,
		"no-or-none-component": noOrNoneComponent,
		"no-button-navigation": noButtonNavigation,
		"no-multi-style-objects": noMultiStyleObjects,
		"no-useless-function": noUselessFunction,
		"min-var-length": minVarLength,
		"max-depth-extended": maxDepthExtended,
		"spring-naming-convention": springNamingConvention,
		"inline-style-limit": inlineStyleLimit,
		"no-inline-prop-types": noInlinePropTypes,
		"no-unnecessary-div": noUnnecessaryDiv
	}
};
