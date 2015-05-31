import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { mediaType, reservedKeys, defaults } from './settings'
import { processData, initializeContext, showLinks, showQueries,
  mapRecord, stringifyObject, attachIncluded, castValue,
  encodeObfuscatedURI } from './helpers'
import * as arrayProxy from '../../../common/array_proxy'


export default Serializer => {
  /**
   * Micro API serializer.
   */
  class MicroApiSerializer extends Serializer {

    constructor () {
      super(...arguments)

      const { options, methods } = this

      const methodMap = {
        GET: methods.find,
        POST: methods.create,
        PATCH: methods.update,
        DELETE: methods.delete
      }

      // Set options.
      for (let key in defaults) if (!(key in options))
        options[key] = defaults[key]

      const uriTemplate = uriTemplates(options ?
        options.uriTemplate : null || defaults.uriTemplate)

      Object.defineProperties(this, {

        // Parse the URI template.
        uriTemplate: { value: uriTemplate },

        // Default method mapping.
        methodMap: { value: methodMap }

      })
    }


    processRequest (context) {
      // If the request was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      const request = arguments[1]

      return processData(request)
      .then(initializeContext.bind(this, context, request))
    }


    processResponse (context) {
      // If the dispatch was initiated without HTTP arguments, this is a no-op.
      if (arguments.length === 1)
        return context

      let { payload, meta } = context.response
      const { options } = this

      if (!meta) meta = context.response.meta = {}

      if (payload && typeof payload === 'object') {
        payload = stringifyObject(payload, options)

        context.response.payload = payload

        meta['Content-Type'] = mediaType
        meta['Content-Length'] = payload.length
      }

      return context
    }


    showIndex (context) {
      const { schemas } = this
      const output = { [reservedKeys.links]: {} }

      for (let type in schemas)
        output[reservedKeys.links][type] = showLinks.call(this, type)

      context.response.payload = output

      return context
    }


    showResponse (context, records, include) {
      if (!records) return this.showIndex(context)

      const { keys, methods, errors, options, uriTemplate } = this
      const { queries, prefix, inflectType } = options
      const { request, response } = context
      const { method, type, ids, relatedField } = request

      // Handle a not found error.
      if (ids && ids.length && method === methods.find &&
        !relatedField && !records.length)
        throw new errors.NotFoundError(`No records match the request.`)

      // Delete and update requests shouldn't respond with anything.
      if (method === methods.delete || method === methods.update)
        return context

      // Create method should include location header.
      if (method === methods.create)
        response.meta['Location'] = prefix +
        encodeObfuscatedURI(uriTemplate.fillFromObject({
          type: inflectType ? inflection.pluralize(type) : type,
          ids: records.map(record => record[keys.primary])
        }), options.obfuscateURIs)

      const output = { [reservedKeys.meta]: {} }

      // If showing a collection, display the count.
      if (!ids && method !== methods.create)
        output[reservedKeys.meta].count = records.count

      // For the find method, it may be helpful to show available queries.
      if (method === methods.find)
        output[reservedKeys.meta].query = showQueries(queries, request)

      // There will always be a type with a link to its collection.
      output[reservedKeys.links] = {
        [type]: showLinks.call(this, type)
      }

      // At least one type will be present.
      output[type] = records.map(record => mapRecord.call(this, type, record))

      if (include) for (let includeType in include) {
        if (!output[includeType]) output[includeType] = []

        // Show links object for include type.
        if (includeType !== type) output[reservedKeys.links][includeType] =
          showLinks.call(this, includeType)

        output[includeType].push(...include[includeType]
          .map(mapRecord.bind(this, includeType))
          .map(attachIncluded))
      }

      if (!Object.keys(output[reservedKeys.meta]).length)
        delete output[reservedKeys.meta]

      context.response.payload = output

      return context
    }


    showError (context, error) {
      const { nativeErrors } = this.errors
      const { name, message } = error
      const output = {}

      output[reservedKeys.error] = !nativeErrors.has(error.constructor) ?
        Object.assign({},
          name ? { name } : null,
          message ? { message } : null,
          error) :
        {
          name: 'Error',
          message: 'An internal server error occured.'
        }

      context.response.payload = output

      return context
    }


    parseCreate (context) {
      const { keys, errors, schemas, options } = this
      const {
        type, payload, relatedField, relatedType, relatedIds
      } = context.request

      if (!(type in payload))
        throw new errors.BadRequestError(
          `The type to be created is missing in the payload.`)

      if (!Array.isArray(payload[type]))
        throw new errors.BadRequestError(
          `The type field must be valued as an array of records.`)

      const schema = schemas[type]
      const records = payload[type].map(record => {
        const links = record[reservedKeys.links]
        const id = record[reservedKeys.id]

        if (id) {
          record[keys.primary] = id
          delete record[reservedKeys.id]
        }

        if (links) {
          for (let field in links)
            record[field] = links[field][reservedKeys.id]

          delete record[reservedKeys.links]
        }

        for (let field in record)
          record[field] = castValue(record[field], schema[field] ?
            schema[field][keys.type] : null, options)

        return record
      })

      // Attach related field based on inverse.
      if (relatedField) {
        const field = schemas[relatedType]
          [relatedField][keys.inverse]
        const relatedArray = schemas[relatedType]
          [relatedField][keys.isArray]
        const isArray = schema[field][keys.isArray]

        if (records.length > 1 && !relatedArray)
          throw new errors.BadRequestError(`Too many records ` +
            `to be created, only one allowed.`)

        if (relatedIds.length > 1 && !isArray)
          throw new errors.BadRequestError(`Invalid request to ` +
            `associate many records to a singular relationship.`)

        for (let record of records)
          record[field] = isArray ? relatedIds : relatedIds[0]
      }

      return records
    }


    parseUpdate (context) {
      const { payload, type, ids } = context.request
      const { keys, errors, options, schemas } = this
      const schema = schemas[type]

      if (!payload[type]) throw new errors.BadRequestError(`The type ` +
        `"${type}" is missing.`)

      if (!Array.isArray(payload[type])) throw new errors.BadRequestError(
        `The type "${type}" must be valued as an array of objects.`)

      return payload[type].map(update => {
        const id = update[reservedKeys.id]

        if (!id) throw new errors.BadRequestError(`An ID is missing.`)

        delete update[reservedKeys.id]

        if (ids && !arrayProxy.includes(ids, id))
          throw new errors.BadRequestError(`The requested ID "${id}" is ` +
            `not addressable.`)

        const links = update[reservedKeys.links]

        if (links) {
          for (let field in links)
            update[field] = links[field][reservedKeys.id]

          delete update[reservedKeys.links]
        }

        const replace = {}
        const cast = (type, options) => value =>
          castValue(value, type, options)

        for (let field in update) {
          const value = update[field]
          const fieldDefinition = schema[field]
          const fieldType = fieldDefinition ?
            fieldDefinition[keys.type] : null

          replace[field] = Array.isArray(value) ?
            value.map(cast(fieldType, options)) :
            castValue(value, fieldType, options)
        }

        update.id = id
        update.replace = replace

        const operate = update[reservedKeys.operate]

        if (operate) {
          update.push = operate.push
          update.pull = operate.pull
          delete update[reservedKeys.update]
        }

        return update
      })
    }

  }

  MicroApiSerializer.id = mediaType

  return MicroApiSerializer
}
