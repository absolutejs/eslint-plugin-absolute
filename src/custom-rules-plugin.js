import noNestedJsxReturn from './rules/no-nested-jsx-return.js';
import explicitObjectTypes from './rules/explicit-object-types.js';
import noTypeCast from './rules/no-type-cast.js';
import sortKeysFixable from './rules/sort-keys-fixable.js';
import noTransitionCssproperties from './rules/no-transition-cssproperties.js';
import noExplicitReturnTypes from './rules/no-explicit-return-types.js';
import maxJsxNesting from './rules/max-jsx-nesting.js';
import seperateStyleFiles from './rules/seperate-style-files.js';
import noUnnecessaryKey from './rules/no-unnecessary-key.js';
import sortExports from './rules/sort-exports.js';
import localizeReactProps from './rules/localize-react-props.js';
import noOrNoneComponent from './rules/no-or-none-component.js';
import noButtonNavigation from './rules/no-button-navigation.js';
import noMultiStyleObjects from './rules/no-multi-style-objects.js';
import noUselessFunction from './rules/no-useless-function.js';
import minVarLength from './rules/min-var-length.js';
import maxDepthExtended from './rules/max-depth-extended.js';
import springNamingConvention from './rules/spring-naming-convention.js';
import inlineStyleLimit from './rules/inline-style-limit.js';
import noInlinePropTypes from './rules/no-inline-prop-types.js';
import noUnnecessaryDiv from './rules/no-unnecessary-div.js';

export default {
	rules: {
		'no-nested-jsx-return': noNestedJsxReturn,
		'explicit-object-types': explicitObjectTypes,
		'no-type-cast': noTypeCast,
		'sort-keys-fixable': sortKeysFixable,
		'no-transition-cssproperties': noTransitionCssproperties,
		'no-explicit-return-type': noExplicitReturnTypes,
		'max-jsxnesting': maxJsxNesting,
		'seperate-style-files': seperateStyleFiles,
		'no-unnecessary-key': noUnnecessaryKey,
		'sort-exports': sortExports,
		'localize-react-props': localizeReactProps,
		'no-or-none-component': noOrNoneComponent,
		'no-button-navigation': noButtonNavigation,
		'no-multi-style-objects': noMultiStyleObjects,
		'no-useless-function': noUselessFunction,
		'min-var-length': minVarLength,
		'max-depth-extended': maxDepthExtended,
		'spring-naming-convention': springNamingConvention,
		'inline-style-limit': inlineStyleLimit,
		'no-inline-prop-types': noInlinePropTypes,
		'no-unnecessary-div': noUnnecessaryDiv
	}
};
