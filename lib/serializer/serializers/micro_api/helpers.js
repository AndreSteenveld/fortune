import inflection from 'inflection'
import { reservedKeys, inBrackets,
  isField, isMatch } from './settings'


const queryDelimiter = '?'


export function processData (request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('error', reject)
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })
}


export function initializeContext (context, request, payload) {
  const {
    uriTemplate, methodMap,
    options, schemas, adapter, keys, errors
  } = this

  let { url } = request

  if (options.obfuscateURIs) {
    // The query string should not be obfuscated.
    const route = url.slice(1).split(queryDelimiter)
    const query = queryDelimiter + route.slice(1).join(queryDelimiter)

    url = '/' + new Buffer((route[0] + Array(5 - route[0].length % 4)
      .join('=')).replace(/\-/g, '+').replace(/_/g, '/'), 'base64')
      .toString() + query
  }

  const uriObject = uriTemplate.fromUri(url)

  if (!Object.keys(uriObject).length && url.length > 1)
    throw new errors.NotFoundError(`Invalid URI.`)

  context.request.method = methodMap[request.method]

  context.request.type = options.inflectType && uriObject.type ?
    inflection.singularize(uriObject.type) : uriObject.type

  context.request.ids = uriObject.ids ?
    (Array.isArray(uriObject.ids) ?
    uriObject.ids : [ uriObject.ids ])
    .map(id => {
      // Stolen from jQuery source code:
      // https://api.jquery.com/jQuery.isNumeric/
      const float = Number.parseFloat(id)
      return id - float + 1 >= 0 ? float : id
    }) : null

  const { type, ids } = context.request
  const schema = schemas[type]

  attachQueries(context, uriObject.query || {}, options)

  if (payload.length)
    context.request.payload = JSON.parse(payload.toString())

  const { relatedField } = uriObject

  if (relatedField && (!(relatedField in schema) ||
    !(keys.link in schema[relatedField]) ||
    keys.denormalizedInverse in schema[relatedField]))
    throw new errors.NotFoundError(`The field "${relatedField}" is ` +
      `not a link on the type "${type}".`)

  return relatedField ? adapter.find(type, ids, {
    // We only care about getting the related field.
    fields: { [relatedField]: true }
  })

  .then(records => {
    // Reduce the related IDs from all of the records into an array of
    // unique IDs.
    const relatedIds = [ ...(records || []).reduce((ids, record) => {
      const value = record[relatedField]

      if (Array.isArray(value)) for (let id of value) ids.add(id)
      else ids.add(value)

      return ids
    }, new Set()) ]

    const relatedType = schema[relatedField][keys.link]

    // Copy the original type and IDs to temporary keys.
    context.request.relatedField = relatedField
    context.request.originalType = type
    context.request.originalIds = ids

    // Write the related info to the request, which should take
    // precedence over the original type and IDs.
    context.request.type = relatedType
    context.request.ids = relatedIds

    return context
  }) : context
}


export function stringifyObject (object, options) {
  return JSON.stringify(object, (key, value) => {
    if (value && value.type === 'Buffer' && Array.isArray(value.data))
      return new Buffer(value.data).toString(options.bufferEncoding)

    return value
  }, options.spaces)
}


function attachQueries (context, query, options) {
  const { request } = context
  const { queries, includeDepth, pageLimit } = options
  const reduceFields = (fields, field) => {
    fields[field] = true
    return fields
  }

  // Iterate over dynamic query strings.
  for (let parameter of Object.keys(query)) {
    // Attach fields option.
    if (parameter.match(isField)) {
      const sparseField = query[parameter]
      const sparseType = (parameter.match(inBrackets) || [])[1]
      const fields = (Array.isArray(sparseField) ?
        sparseField : [ sparseField ]).reduce(reduceFields, {})

      if (sparseType === request.type)
        request.options.fields = fields
      else if (sparseType) {
        if (!(sparseType in request.includeOptions))
          request.includeOptions[sparseType] = {}

        request.includeOptions[sparseType].fields = fields
      }
    }

    // Attach match option.
    if (parameter.match(isMatch)) {
      if (!request.options.match) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = query[parameter]
    }
  }

  // Attach sort option.
  if (queries.has('sort') && query.sort) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [ sort ]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      if (firstChar === '-') sort[field.slice(1)] = -1
      else sort[field] = 1

      return sort
    }, {})
  }

  // Attach include option.
  if (queries.has('include') && query.include)
    request.include = (Array.isArray(query.include) ?
      query.include : [ query.include ])
      .map(i => i.split('.')
      .slice(0, includeDepth))

  // Attach offset option.
  if (queries.has('offset') && query.offset)
    request.options.offset =
      Math.abs(parseInt(query.offset, 10))

  // Attach default limit.
  if (queries.has('limit') && query.limit) {
    const limit = Math.abs(parseInt(query.limit, 10))
    request.options.limit =
      limit > pageLimit ? pageLimit : limit
  }
  else request.options.limit = pageLimit
}


export function showLinks (type) {
  const { options, uriTemplate, keys, schemas } = this
  const schema = schemas[type]
  const { inflectType, obfuscateURIs } = options
  const output = {
    [reservedKeys.href]: encodeObfuscatedURI(uriTemplate.fillFromObject({
      type: inflectType ? inflection.pluralize(type) : type
    }), obfuscateURIs)
  }

  for (let field in schema) {
    const fieldDefinition = schema[field]

    if (!fieldDefinition[keys.link]) continue

    output[field] = {
      [reservedKeys.type]: fieldDefinition[keys.link],
      [reservedKeys.array]: Boolean(fieldDefinition[keys.isArray])
    }

    const link = fieldDefinition[keys.link]
    const inverse = fieldDefinition[keys.inverse]

    // Show inverse on link fields that do not have a denormalized inverse.
    if (inverse && !schemas[link][inverse][keys.denormalizedInverse])
      output[field][reservedKeys.inverse] = inverse
  }

  return output
}


export function mapRecord (type, record) {
  const { keys, options, schemas, uriTemplate } = this
  const schema = schemas[type]
  const { prefix, inflectType, obfuscateURIs } = options

  const id = record[keys.primary]
  delete record[keys.primary]

  const fields = Object.keys(record)

  record[reservedKeys.id] = id
  record[reservedKeys.meta] = {}
  record[reservedKeys.links] = {
    [reservedKeys.href]: prefix +
      encodeObfuscatedURI(uriTemplate.fillFromObject({
        type: inflectType ? inflection.pluralize(type) : type,
        ids: id
      }), obfuscateURIs)
  }

  for (let field of fields) {
    const fieldDefinition = schema[field]

    // Handle non-schema fields.
    if (!fieldDefinition) {
      const value = record[field]
      delete record[field]
      record[reservedKeys.meta][field] = value
      continue
    }

    // Rearrange order of typed schema fields.
    if (fieldDefinition[keys.type]) {
      const value = record[field]
      delete record[field]
      record[field] = value
      continue
    }

    // Handle link fields.
    const ids = record[field]
    delete record[field]

    record[reservedKeys.links][field] = {
      [reservedKeys.href]: prefix +
        encodeObfuscatedURI(uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type,
          ids: id, relatedField: field
        }), obfuscateURIs),
      [reservedKeys.id]: ids
    }
  }

  if (!Object.keys(record[reservedKeys.meta]).length)
    delete record[reservedKeys.meta]

  return record
}


export function showQueries (queries, request) {
  const query = {}

  if (queries.has('include'))
    query.include = request.include ?
      request.include.map(path => path.join('.')) : []

  if (queries.has('offset'))
    query.offset = request.options.offset || 0

  if (queries.has('limit'))
    query.limit = request.options.limit || 0

  if (queries.has('match'))
    query.match = request.options.match || {}

  if (queries.has('field'))
    query.field = request.options.field || {}

  if (queries.has('sort'))
    query.sort = request.options.sort || {}

  return query
}


export function castValue (value, type, options) {
  const { bufferEncoding } = options

  if (type === Date)
    return new Date(value)

  if (type === Buffer)
    return new Buffer((value || '').toString(), bufferEncoding)

  return value
}


export function attachIncluded (record) {
  if (!record[reservedKeys.meta]) record[reservedKeys.meta] = {}
  record[reservedKeys.meta].included = true

  return record
}


/**
 * Encode a route in Base64 encoding.
 *
 * @param {String} uri
 * @param {Boolean} encode
 */
export function encodeObfuscatedURI (uri, encode) {
  return encode ? '/' + new Buffer(uri.slice(1)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : uri
}
