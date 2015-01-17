export default Parser;


// The names of the publicly exposed keys.
export const keys = {
  type: 'type',
  link: 'link',
  inverse: 'inverse'
};

// This string is shared between functions.
var resource;


/*!
 * Given a schema object, turn the values of the fields into something that is
 * more verbose and easier to use. The input `[Number]` may produce output
 * that looks something like:
 *
 * ```js
 * {
 *   type: 'number',
 *   isArray: true
 * }
 * ```
 *
 * @param {String} name
 * @param {Object} schema
 * @param {Object} options
 * @return {Object}
 */
function Parser (name, schema = {}, options = {}) {

  resource = name;

  for (let key in schema) {
    let output = {};

    if (~['function', 'string'].indexOf(typeof schema[key])) {
      output.type = coerceString(schema[key]);
    } else if (typeof schema[key] === 'object' && schema[key] !== null) {
      output = parseObject(schema[key], key);
    } else {
      warn('The definition of schema field "' + key + '" is invalid.');
    }

    if (Object.keys(output).length) {
      schema[key] = output;
    } else {
      delete schema[key];
    }
  }

  schema._options = options;
  return schema;
}


/*!
 * Coerce a native constructor such as Number or String
 * into a string literal. This makes checking types more straightforward.
 *
 * @param {Function|String} constructor
 * @return {String}
 */
function coerceString (constructor) {
  var type;

  // valid string literal types
  const types = ['string', 'number', 'boolean',
    'date', 'object', 'array', 'buffer'];

  if (typeof constructor === 'string') {
    if (~types.indexOf(constructor)) {
      type = constructor;
    } else {
      warn('The type "' + constructor + '" is unrecognized.');
    }

  } else if (typeof constructor === 'function') {
    // native constructors need to be disambiguated
    if (constructor === String) type = 'string';
    else if (constructor === Number) type = 'number';
    else if (constructor === Boolean) type = 'boolean';
    else if (constructor === Date) type = 'date';
    else if (constructor === Object) type = 'object';
    else if (constructor === Array) type = 'array';
    else if (constructor === Buffer) type = 'buffer';
    else {
      warn('Unknown type for ' + type + '".');
    }

  } else {
    warn('Invalid type "' + constructor + '".');
  }

  return type;
}


/*!
 * Parse an object on a schema field.
 *
 * @param {Object} value
 * @param {String} key
 * @return {Object}
 */
function parseObject (value, key) {
  var output = {};

  value = coerceSingular(value, output, keys.type, key);

  // `function` here refers to the type of a native object such as `String`.
  if (typeof value === 'function') {
    output.type = coerceString(value);
  }

  // Process each of the attributes, there are a few reserved names.
  for (let attribute in value) {
    if (attribute === keys.link) {

      value[attribute] = coerceSingular(
        value[attribute], output, attribute, key);

      if (typeof value[attribute] === 'string' && value[attribute].length) {
        output.link = value[attribute];
      } else {
        warn('The "' + attribute + '" key on the schema field "' + key +
          '" must be a string or array of strings. The "' + key +
          '" field has been dropped.');
      }

    } else if (attribute === keys.inverse) {

      if (typeof value[attribute] === 'string' && value[attribute].length) {
        output.inverse = value[attribute];
      } else {
        warn('The "' + attribute + '" key on the schema field "' + key +
          '" must be a string. The "' + attribute + '" key has been dropped.');
      }

    } else if (attribute === keys.type) {

      value[attribute] = coerceSingular(
        value[attribute], output, attribute, key);
      output.type = coerceString(value[attribute]);

    } else {

      output[attribute] = value[attribute];

    }
  }

  // Do some sanity checking.
  // Link and type are not allowed, because a link's type is not meant to be
  // specified by the user.
  if (output.hasOwnProperty(keys.type) && output.hasOwnProperty(keys.link)) {
    delete output[keys.type];
    warn('The field "' + key + '" can not have both of the keys "' +
      keys.link + '" and "' + keys.type + '". The "' + keys.type +
      '" key has been dropped.');
  }

  // Must have either a type or a link, otherwise it is invalid.
  if (!output.hasOwnProperty(keys.type) && !output.hasOwnProperty(keys.link)) {
    warn('The schema field "' + key + '" must contain either "' + keys.type +
      '" or "' + keys.link + '" keys.');
    return {};
  }

  return output;
}


/*!
 * Coerce an array into the first value of the array.
 * Causes a side effect on `output` object.
 *
 * @param {Object} value
 * @param {Object} output
 * @param {String} type
 * @param {String} key
 */
function coerceSingular (value, output, type, key) {
  if (Array.isArray(value)) {
    if (!value.length) {
      warn('Empty array in "' + type + '" of key "' + key + '".');
      return {};
    }
    if (value.length > 1) {
      warn('Only the first value of "' + type + '" will be used on key "' +
        key + '".');
    }
    value = value[0];
    output.isArray = true;
  } else {
    output.isArray = false;
  }
  return value;
}


/*!
 * Send a warning.
 *
 * @param {String} str
 */
function warn (str) {
  console.warn('On "' + resource + '" resource: ' + str);
}
