'use strict'

var urlLib = require('url')
var parseUrl = urlLib.parse

var message = require('../common/message')
var methods = require('../common/methods')
var assign = require('../common/assign')
var castValue = require('../common/cast_value')
var map = require('../common/array/map')
var reduce = require('../common/array/reduce')

var errors = require('../common/errors')
var NotFoundError = errors.NotFoundError

var keys = require('../common/keys')
var typeKey = keys.type
var linkKey = keys.link
var denormalizedInverseKey = keys.denormalizedInverse

var isMatch = /^match/
var isRange = /^range/
var isExists = /^exists/

var methodMap = {
  'GET': methods.find,
  'POST': methods.create,
  'PATCH': methods.update,
  'DELETE': methods.delete
}

var allowLevel = [
  [ 'GET' ], // Index
  [ 'GET', 'POST', 'PATCH', 'DELETE' ], // Collection
  [ 'GET', 'PATCH', 'DELETE' ], // Records
  [ 'GET', 'PATCH', 'DELETE' ] // Related records
]

var entityMap = {
  '-': '+',
  '_': '/'
}


function initializeContext (contextRequest, request, response) {
  var recordTypes = this.recordTypes
  var adapter = this.adapter
  var meta = contextRequest.meta
  var options = this.options
  var uriBase64 = options.uriBase64
  var castId = options.castId
  var url = request.url
  var type, ids, method, fields, relatedField, language
  var parsedUrl, parts, route, query, findOptions, output, i

  request.meta = {}

  language = request.meta.language = meta.language

  // Set the request method.
  method = request.meta.method = contextRequest.method =
    methodMap[request.method]

  // Decode URIs.
  if (uriBase64) {
    // The query string should not be encoded.
    route = url.slice(1).split('?')
    query = '?' + route.slice(1).join('?')

    url = '/' + new Buffer((route[0] + Array(5 - route[0].length % 4)
      .join('=')).replace(/[\-_]/g, function (x) { return entityMap[x] }),
      'base64').toString() + query
  }

  parsedUrl = contextRequest.parsedUrl = parseUrl(url, true)
  parts = parsedUrl.pathname.split('/')

  // Strip empty parts, and decode.
  for (i = parts.length; i--;)
    if (!parts[i]) parts.splice(i, 1)
    else parts[i] = decodeURIComponent(parts[i])

  if (parts.length > 3)
    throw new NotFoundError(message('InvalidURL', language))

  // Respond to options request, or otherwise invalid method.
  if (!method) {
    response.statusCode = 204
    output = {
      meta: {
        headers: {
          'Allow': allowLevel[parts.length].join(', ')
        }
      }
    }
    throw output
  }

  if (parts[0]) {
    type = request.meta.type = contextRequest.type = parsedUrl.type =
      parts[0]

    if (!(type in recordTypes))
      throw new NotFoundError(message('InvalidType', language, { type: type }))

    fields = recordTypes[type]
  }

  if (parts[1]) {
    ids = request.meta.ids = contextRequest.ids = parsedUrl.ids =
      parts[1].split(',')

    if (castId)
      ids = request.meta.ids = contextRequest.ids = map(ids, castToNumber)
  }

  if (parts[2])
    relatedField = contextRequest.relatedField = request.meta.relatedField =
      parsedUrl.relatedField = parts[2]

  attachQueries.call(this, contextRequest)

  request.meta.include = contextRequest.include
  request.meta.options = contextRequest.options

  if (relatedField) {
    if (!(relatedField in fields) ||
      !(linkKey in fields[relatedField]) ||
      fields[relatedField][denormalizedInverseKey])
      throw new NotFoundError(message('InvalidURL', language))

    // Only care about getting the related field.
    findOptions = { fields: {} }
    findOptions.fields[relatedField] = true

    return adapter.find(type, ids, findOptions, meta)

    .then(function (records) {
      // Reduce the related IDs from all of the records into an array of
      // unique IDs.
      var relatedIds = []
      var relatedType
      var seen = {}
      var value, i, j

      for (i = records.length; i--;) {
        value = records[i][relatedField]

        if (!Array.isArray(value)) value = [ value ]

        for (j = value.length; j--;)
          if (!(value[j] in seen)) {
            seen[value[j]] = true
            relatedIds.push(value[j])
          }
      }

      relatedType = fields[relatedField][linkKey]

      // Copy the original type and IDs to other keys.
      contextRequest.originalType = request.meta.originalType = type
      contextRequest.originalIds = request.meta.originalIds = ids

      // Write the related info to the request, which should take
      // precedence over the original type and IDs.
      contextRequest.type = request.meta.type = relatedType
      contextRequest.ids = request.meta.ids = relatedIds

      return contextRequest
    })
  }

  return contextRequest
}


function attachQueries (contextRequest) {
  var recordTypes = this.recordTypes
  var includeLimit = this.options.includeLimit || 5
  var maxLimit = this.options.maxLimit || 1000
  var options = contextRequest.options = {}
  var type = contextRequest.type
  var fields = recordTypes[type]
  var query = contextRequest.parsedUrl.query
  var opts = { language: contextRequest.meta.language }
  var parameter, field, fieldType, value, limit

  // Attach fields option.
  if ('fields' in query) {
    options.fields = reduce(
      Array.isArray(query.fields) ? query.fields : [ query.fields ],
      function (fields, field) {
        fields[field] = true
        return fields
      }, {})

    // Remove empty queries.
    delete options.fields['']
    if (!Object.keys(options.fields).length) delete options.fields
  }

  // Iterate over dynamic query strings.
  for (parameter in query) {
    field = parameter.split('.')[1]

    // Attach match option.
    if (parameter.match(isMatch)) {
      value = query[parameter]
      if (value === '') continue
      if (!options.match) options.match = {}
      fieldType = fields[field][typeKey]

      options.match[field] = Array.isArray(value) ? map(value,
        curryCast(castValue, fieldType, assign(opts, options))) :
        castValue(value, fieldType, assign(opts, options))

      continue
    }

    // Attach range option.
    if (parameter.match(isRange)) {
      value = query[parameter]
      if (value === '') continue
      if (!options.range) options.range = {}
      fieldType = fields[field][typeKey]

      if (!Array.isArray(value)) value = [ value ]

      options.range[field] = map(value,
        curryCast(castValue, fieldType, assign(opts, this.options)))

      continue
    }

    // Attach exists option.
    if (parameter.match(isExists)) {
      value = query[parameter]
      if (value === '') continue
      if (!options.exists) options.exists = {}
      if (value === '0' || value === 'false')
        options.exists[field] = false
      if (value === '1' || value === 'true')
        options.exists[field] = true
    }
  }

  // Attach sort option.
  if ('sort' in query) {
    options.sort = reduce(
      Array.isArray(query.sort) ? query.sort : [ query.sort ],
      function (sort, field) {
        if (field.charAt(0) === '-') sort[field.slice(1)] = false
        else sort[field] = true
        return sort
      }, {})

    // Remove empty queries.
    delete options.sort['']
    if (!Object.keys(options.sort).length) delete options.sort
  }

  // Attach include option.
  if ('include' in query)
    contextRequest.include = map(
      Array.isArray(query.include) ? query.include : [ query.include ],
      function (x) { return x.split('.').slice(0, includeLimit) })

  // Attach offset option.
  if ('offset' in query)
    options.offset = Math.abs(parseInt(query.offset, 10))

  // Attach limit option.
  if ('limit' in query)
    options.limit = Math.abs(parseInt(query.limit, 10))

  // Check limit option.
  limit = options.limit
  if (!limit || limit > maxLimit) options.limit = maxLimit
}


function curryCast (fn, type, options) {
  return function (value) {
    return fn(value, type, options)
  }
}


function castToNumber (id) {
  // Stolen from jQuery source code:
  // https://api.jquery.com/jQuery.isNumeric/
  var float = Number.parseFloat(id)
  return id - float + 1 >= 0 ? float : id
}


module.exports = initializeContext
