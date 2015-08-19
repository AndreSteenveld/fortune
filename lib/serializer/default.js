import clone from 'clone'
import Serializer from './'


/**
 * Default serializer implementation. It doesn't have an ID, because it doesn't
 * need one.
 */
export default class DefaultSerializer extends Serializer {

  showResponse (context, records, include) {
    const { response } = context

    if (!records) {
      response.payload = Object.keys(this.recordTypes)
      return context
    }

    if (include) records.include = include
    response.payload = records

    return context
  }


  showError (context, error) {
    const { response } = context
    const { name, message } = error

    response.payload = Object.assign({ name }, message ? { message } : null)

    return context
  }


  parseCreate (context) {
    const { errors: { BadRequestError } } = this
    const { request: { ids, payload } } = context

    if (ids) throw new BadRequestError(`IDs should not be specified.`)

    return clone(payload) || []
  }


  parseUpdate (context) {
    const { errors: { BadRequestError } } = this
    const { request: { ids, payload } } = context

    if (ids) throw new BadRequestError(`IDs should not be specified.`)

    return clone(payload) || []
  }

}
