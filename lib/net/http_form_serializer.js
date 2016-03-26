'use strict'

var Busboy = require('busboy')
var stream = require('stream')
var promise = require('../common/promise')
var assign = require('../common/assign')


function inherit (HttpSerializer) {
  function FormSerializer (properties) {
    HttpSerializer.call(this, properties)
  }

  FormSerializer.prototype = Object.create(HttpSerializer.prototype)


  FormSerializer.prototype.processRequest = function (contextRequest) {
    throw new this.errors.UnsupportedError(
      this.message('InputOnly', contextRequest.meta.language))
  }


  FormSerializer.prototype.parsePayload = function (contextRequest, request) {
    var BadRequestError = this.errors.BadRequestError
    var primaryKey = this.keys.primary
    var message = this.message
    var methods = this.methods
    var language = contextRequest.meta.language

    return this.parse(contextRequest)

    .then(function (records) {
      var record = records[0]
      var method = contextRequest.method

      if ('method' in record) {
        method = contextRequest.method = request.meta.method = record.method
        delete record.method
      }

      return method === methods.update ? (function () {
        var id = record[primaryKey]
        var float = Number.parseFloat(id)
        // Stolen from jQuery source code:
        // https://api.jquery.com/jQuery.isNumeric/
        id = id - float + 1 >= 0 ? float : id

        if (!id) throw new BadRequestError(message('MissingID', language))
        delete record[primaryKey]

        return [
          {
            id: id,
            replace: record
          }
        ]
      }()) : records
    })
  }


  FormSerializer.prototype.parse = function (contextRequest) {
    var Promise = promise.Promise
    var headers = contextRequest.meta.headers
    var payload = contextRequest.payload
    var type = contextRequest.type
    var recordTypes = this.recordTypes
    var opts = { language: contextRequest.meta.language }
    var options = this.options
    var castValue = this.castValue
    var isArrayKey = this.keys.isArray
    var typeKey = this.keys.type
    var fields = recordTypes[type]
    var busboy = new Busboy({ headers: headers })
    var bufferStream = new stream.PassThrough()
    var record = {}

    return new Promise(function (resolve) {
      busboy.on('file', function (field, file, filename) {
        var fieldDefinition = fields[field] || {}
        var fieldIsArray = fieldDefinition[isArrayKey]
        var chunks = []

        if (fieldIsArray && !(field in record))
          record[field] = []

        file.on('data', function (chunk) { chunks.push(chunk) })
        file.on('end', function () {
          var data = Buffer.concat(chunks)
          data.filename = filename

          if (fieldIsArray) {
            record[field].push(data)
            return
          }

          if (field in record) {
            if (Array.isArray(record[field]))
              record[field].push(data)
            else record[field] = [ record[field], data ]
            return
          }

          record[field] = data
        })
      })

      busboy.on('field', function (field, value) {
        var fieldDefinition = fields[field] || {}
        var fieldType = fieldDefinition[typeKey]
        var fieldIsArray = fieldDefinition[isArrayKey]
        value = castValue(value, fieldType, assign(opts, options))

        if (fieldIsArray) {
          if (!(field in record)) record[field] = []
          record[field].push(value)
          return
        }

        if (field in record) {
          if (Array.isArray(record[field]))
            record[field].push(value)
          else record[field] = [ record[field], value ]
          return
        }

        record[field] = value
      })

      busboy.on('finish', function () { resolve([ record ]) })

      bufferStream.end(payload)
      bufferStream.pipe(busboy)
    })
  }


  return FormSerializer
}


exports.formUrlEncoded = function (Serializer) {
  return assign(inherit(Serializer),
    { mediaType: 'application/x-www-form-urlencoded' })
}


exports.formData = function (Serializer) {
  return assign(inherit(Serializer),
    { mediaType: 'multipart/form-data' })
}
