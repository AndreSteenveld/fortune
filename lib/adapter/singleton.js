import Adapter from './';
import excludedKeys from '../common/excluded_keys';
import enumerateMethods from '../common/enumerate_methods';

/**
 * A singleton for the adapter. For internal use.
 */
export default class extends Adapter {
  constructor (context) {
    let adapter = context.options.adapter.type;

    // Coerce a constructor function into its prototype.
    if (typeof adapter === 'function')
      adapter = enumerateMethods(adapter);

    super(Object.assign(adapter, {
      options: context.options.adapter.options || {},
      schemas: context.schemas
    }, {
      options: {
        // This gives us generic options merged into the
        // serializer's options under the `generic` key.
        generic: Object.keys(context.options).reduce((options, key) => {
          if (!(key in excludedKeys))
            options[key] = context.options[key];
          return options;
        }, {})
      }
    }));
  }
}
