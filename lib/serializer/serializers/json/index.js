'use strict'

var url = require('url')
var DefaultSerializer = require('../../default')
var assign = require('../../../common/assign')
var map = require('../../../common/array/map')
var reduce = require('../../../common/array/reduce')
var constants = require('../../../common/constants')
var internalKey = constants.internal

var inBrackets = /\[([^\]]+)\]/
var isMatch = /^match/


module.exports = function () {
  /**
   * This is an ad hoc JSON-over-HTTP serializer, which is suitable only for
   * prototyping or internal use.
   */
  function JsonSerializer (properties) {
    DefaultSerializer.call(this, properties)

    Object.defineProperties(this, {
      methodMap: {
        value: {
          'GET': this.methods.find,
          'POST': this.methods.create,
          'PATCH': this.methods.update,
          'DELETE': this.methods.delete
        }
      }
    })
  }

  Object.defineProperty(JsonSerializer, internalKey, { value: true })

  JsonSerializer.prototype = Object.create(DefaultSerializer.prototype)

  JsonSerializer.prototype.processRequest = function (context) {
    var message = this.message
    var recordTypes = this.recordTypes
    var methodMap = this.methodMap
    var castValue = this.castValue
    var NotFoundError = this.errors.NotFoundError
    var typeKey = this.keys.type
    var language = context.request.meta.language
    var opts = { language: language }
    var request, parsedUrl, pathname, query, parts, fields, options
    var parameter, field, fieldType, value

    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1) return context

    request = arguments[1]
    parsedUrl = url.parse(request.url, true)
    pathname = parsedUrl.pathname
    query = parsedUrl.query
    parts = pathname.slice(1).split('/')

    if (parts.length > 2)
      throw new NotFoundError(message('InvalidURL', language))

    // Check for HTTP method override headers.
    context.request.method = methodMap[
      request.headers['x-http-method-override'] ||
      request.headers['x-method-override'] ||
      request.headers['x-http-method'] ||
      request.method]

    context.request.type = decodeURIComponent(parts[0]) || null
    context.request.ids = parts[1] ?
      map(decodeURIComponent(parts[1]).split(','), function (id) {
        // Stolen from jQuery source code:
        // https://api.jquery.com/jQuery.isNumeric/
        var float = Number.parseFloat(id)
        return id - float + 1 >= 0 ? float : id
      }) : null

    fields = recordTypes[context.request.type]
    options = context.request.options

    // Attach include option.
    if ('include' in query)
      context.request.include = map(query.include.split(','),
        function (x) { return x.split('.') })

    // Set default limit to 1000.
    options.limit = 'limit' in query ?
      parseInt(query.limit, 10) : 1000
    options.offset = 'offset' in query ?
      parseInt(query.offset, 10) : 0

    // Attach fields option.
    if ('fields' in query)
      options.fields = reduce(query.fields.split(','),
        function (fields, field) {
          fields[field] = true
          return fields
        }, {})

    // Attach match option.
    for (parameter in query)
      if (parameter.match(isMatch)) {
        if (!options.match) options.match = {}
        field = (parameter.match(inBrackets) || [])[1]
        fieldType = fields[field][typeKey]
        value = query[parameter]

        options.match[field] = Array.isArray(value) ? map(value,
          curryCast(castValue, fieldType, assign(opts, this.options))) :
          castValue(value, fieldType, assign(opts, this.options))
      }

    // Attach sort option.
    if ('sort' in query)
      options.sort = reduce(query.sort.split(','),
        function (sort, field) {
          if (field.charAt(0) === '-') sort[field.slice(1)] = false
          else sort[field] = true

          return sort
        }, {})

    return context
  }


  JsonSerializer.prototype.processResponse =
    function (context, request, response) {
      var jsonSpaces = this.options.jsonSpaces || 2
      var bufferEncoding = this.options.bufferEncoding || 'base64'
      var payload = context.response.payload

      if (arguments.length === 1) return context

      // Set the charset to UTF-8.
      response.setHeader('Content-Type',
        JsonSerializer.id + '; charset=utf-8')

      if (payload != null)
        context.response.payload = JSON.stringify(payload,
          function (key, value) {
            // Duck type checking for buffer stringification.
            if (value && value.type === 'Buffer' &&
              Array.isArray(value.data) &&
              Object.keys(value).length === 2)
              return new Buffer(value.data).toString(bufferEncoding)

            return value
          }, jsonSpaces)

      return context
    }


  JsonSerializer.prototype.showResponse =
    function (context, records, include) {
      var updateMethod = this.methods.update
      var deleteMethod = this.methods.delete
      var method = context.request.method
      var updateModified = context.response.updateModified
      var i, j, record, type

      // Delete and update requests may not respond with anything.
      if (method === deleteMethod ||
        (method === updateMethod && !updateModified))
        return context

      DefaultSerializer.prototype.showResponse
        .call(this, context, records, include)

      if (records) for (i = 0, j = records.length; i < j; i++)
        records[i].type = context.request.type

      if (include) {
        delete records.include
        for (type in include)
          for (i = 0, j = include[type].length; i < j; i++) {
            record = include[type][i]
            record.type = type
            context.response.payload.push(record)
          }
      }

      return context
    }


  JsonSerializer.prototype.parseCreate = function (context) {
    var opts = { language: context.request.meta.language }
    var options = this.options
    var recordTypes = this.recordTypes
    var castValue = this.castValue
    var typeKey = this.keys.type
    var type = context.request.type
    var fields = recordTypes[type]
    var i, j, records, record, field, value, fieldDefinition, fieldType

    context.request.payload = parseBuffer.call(this, context.request.payload)
    records = DefaultSerializer.prototype.parseCreate.call(this, context)

    for (i = 0, j = records.length; i < j; i++) {
      record = records[i]
      for (field in record) {
        value = record[field]
        fieldDefinition = fields[field] || {}
        fieldType = fieldDefinition[typeKey]

        record[field] = Array.isArray(value) ?
          map(value, curryCast(castValue, fieldType, assign(opts, options))) :
          castValue(value, fieldType, assign(opts, options))
      }
    }

    return records
  }


  JsonSerializer.prototype.parseUpdate = function (context) {
    var i, update, updates

    context.request.payload = parseBuffer.call(this, context.request.payload)
    updates = DefaultSerializer.prototype.parseUpdate.call(this, context)

    for (i = updates.length; i--;) {
      update = updates[i]
      castFields.call(this, context, update.replace, update.push, update.pull)
    }

    return updates
  }

  JsonSerializer.id = 'application/json'

  return JsonSerializer
}


function parseBuffer (payload) {
  var BadRequestError = this.errors.BadRequestError

  if (!Buffer.isBuffer(payload)) return null

  try {
    return JSON.parse(payload.toString())
  }
  catch (error) {
    throw new BadRequestError(error.message)
  }
}


function curryCast (fn, type, options) {
  return function (value) {
    return fn(value, type, options)
  }
}


function castFields (context) {
  var opts = { language: context.request.meta.language }
  var options = this.options
  var castValue = this.castValue
  var typeKey = this.keys.type
  var fields = this.recordTypes[context.request.type]
  var i, j, object, field, value, fieldDefinition, fieldType

  for (i = 1, j = arguments.length; i < j; i++) {
    object = arguments[i]
    for (field in object) {
      value = object[field]
      fieldDefinition = fields[field] || {}
      fieldType = fieldDefinition[typeKey]

      object[field] = Array.isArray(value) ?
        map(value, curryCast(castValue, fieldType, assign(opts, options))) :
        castValue(value, fieldType, assign(opts, options))
    }
  }
}
