import keys from './reserved_keys';

/*!
 * This module typecasts values to match the given schema.
 *
 * @param {Object} object
 * @param {Object} schema
 * @param {Boolean} output whether or not we are outputting an entity
 * @return {Object}
 */
export default function Enforcer (object, schema, output) {

  // Sanity check, effectively a no-op if we don't get an object.
  if (typeof object !== 'object')
    return object;

  for (let key in object) {
    let value;
    let type;

    if (key in schema) {
      type = schema[key][keys.type];
    } else {
      if (!output) {
        delete object[key];
      }
      continue;
    }

    if (!schema[key].isArray) {
      value = !output ?
        castType(object[key], type) :
        mangleType(object[key], type);
    } else {
      if (Array.isArray(object[key])) {
        value = object[key].map(!output ?
          value => castType(value, type) :
          value => mangleType(value, type));
      } else {
        value = [!output ?
          castType(object[key], type) :
          mangleType(object[key], type)];
      }
    }

    if (value !== undefined) {
      object[key] = value;
    } else {
      delete object[key];
    }
  }

  return object;
}


/*!
 * Cast a value into a type.
 *
 * @param value
 * @param {String} type
 */
function castType (value, type) {
  const caster = {
    string: value => value.toString(),
    number: value => parseInt(value, 10),
    boolean: value => !!value,
    date: value => new Date(value),
    object: value => typeof value === 'object' ? new Object(value) : null,
    array: value => new Array(value),
    buffer: value => new Buffer(value || '', 'base64')
  };

  if (type in caster) {
    return caster[type](value);
  } else {
    if (!!type) console.warn('The type "' + type + '" is unrecognized.');
    return value;
  }
}


/*!
 * Mangle a value to be sent over the wire.
 *
 * @param value
 * @param {String} type
 */
function mangleType (value, type) {
  const mangler = {
    string: value => value.toString(),
    number: value => parseInt(value, 10),
    boolean: value => !!value,
    date: value =>  new Date(value).getTime(),
    object: value => value,
    array: value => Array.isArray(value) ? value : null,
    buffer: value => Buffer.isBuffer(value) ? value.toString('base64') : null
  };

  if (type in mangler) {
    return mangler[type](value);
  } else {
    if (!!type) console.warn('The type "' + type + '" is unrecognized.');
    return value;
  }
}
