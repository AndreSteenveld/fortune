export const bufferEncoding = 'base64'
export const idKey = '_id'


// Cast and assign values per field.
export function inputRecord (type, record) {
  const clone = {}
  const { recordTypes, keys } = this
  const fields = recordTypes[type]
  const toString = buffer => buffer.toString(bufferEncoding)

  // ID business.
  const id = record[keys.primary]
  if (id) clone[idKey] = id

  for (let field in record) {
    clone[field] = record[field]
  }

  for (let field of Object.getOwnPropertyNames(fields)) {
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]

    if (!(field in record)) {
      clone[field] = fieldIsArray ? [] : null
      continue
    }

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field]) {
      clone[field] = fieldIsArray ?
        record[field].map(toString) :
        record[field].toString(bufferEncoding)
      continue
    }
  }

  return clone
}


// We get a new object for each record from NeDB, so we don't have to worry
// about cloning.
export function outputRecord (type, record) {
  const { recordTypes, keys } = this
  const fields = recordTypes[type]
  const toBuffer = string => new Buffer(string, bufferEncoding)

  // ID business.
  const id = record[idKey]
  delete record[idKey]
  record[keys.primary] = id

  for (let field of Object.keys(record)) {
    if (!(field in fields)) continue

    const value = record[field]
    const fieldType = fields[field][keys.type]
    const fieldIsArray = fields[field][keys.isArray]
    const fieldIsDenormalized = fields[field][keys.denormalizedInverse]

    // NeDB lacks native support for buffer types.
    if (fieldType === Buffer && record[field])
      record[field] = fieldIsArray ?
        value.map(toBuffer) : new Buffer(value, bufferEncoding)

    // Do not enumerate denormalized fields.
    if (fieldIsDenormalized) {
      delete record[field]
      Object.defineProperty(record, field, {
        configurable: true, writable: true, value
      })
    }
  }

  return record
}


/**
 * Immutable mapping on an object.
 *
 * @param {Object} object
 * @param {Function} map should return the first argument, which is the value
 * @return {Object}
 */
export function mapValues (object, map) {
  return Object.keys(object).reduce((clone, key) =>
    Object.assign(clone, { [key]: map(object[key], key) }), {})
}


/**
 * Cast non-native types.
 *
 * @param {*} value
 * @return {*}
 */
export function castValue (value) {
  if (Buffer.isBuffer(value))
    return value.toString(bufferEncoding)

  return value
}
