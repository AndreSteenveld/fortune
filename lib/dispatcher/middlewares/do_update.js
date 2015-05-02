import checkLinks from '../../adapter/check_links'
import applyUpdate from '../../adapter/apply_update'
import enforce from '../../schema/enforce'
import * as keys from '../../common/reserved_keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'
import * as operations from '../update_operations'

/*!
 * Do updates. First, it must find the records to update, then run transforms
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type, ids } = context.request
  const { adapter, serializer, events, schemas, transforms } = this
  const updates = serializer.parseUpdate(context)

  // Keyed by update, valued by record.
  const updateMap = new WeakMap()

  const schema = schemas[type]
  const links = new Set(Object.keys(schema)
    .filter(field => schema[field][keys.link]))

  const relatedUpdates = {}
  let transaction

  validateUpdates(updates, ids)

  return adapter.find(type, updates.map(update => update[keys.primary]))

  .then(records => Promise.all(records.map(record => {
    const update = arrayProxy.find(updates, update =>
      update[keys.primary] === record[keys.primary])

    if (!update)
      throw new errors.NotFoundError(
        `The record to be updated could not be found.`)

    updateMap.set(update, record)

    // Apply updates to record.
    record = applyUpdate(record, schema, update)

    // Enforce the schema before running transform.
    record = enforce(record, schema)

    // Ensure referential integrity.
    return checkLinks(record, schema, links, adapter)

    // Do input transforms.
    .then(() => 'input' in (transforms[type] || {}) ?
      transforms[type].input(context, record) : null)
  })))

  .then(() => adapter.beginTransaction())

  .then(t => {
    transaction = t
    return transaction.update(type, updates)
  })

  .then(() => {
    // Build up related updates based on update objects.
    const idCache = {}

    // Iterate over each update to generate related updates.
    updates.forEach(update => links.forEach(field => {
      const inverseField = schema[field][keys.inverse]

      if (!inverseField) return

      const linkedType = schema[field][keys.link]
      const linkedIsArray = schemas[linkedType][inverseField][keys.isArray]

      // Do some initialization.
      if (!(linkedType in updates)) relatedUpdates[linkedType] = []
      if (!(linkedType in idCache)) idCache[linkedType] = new Set()

      // Setting a link field is pretty complicated.
      if (field in update.set) {
        const id = update.set[field]
        const record = updateMap.get(update)

        // Set related field.
        if (id !== null)
          operations.addId(update.id,
            operations.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray)

        // For unsetting, remove ID from related record.
        if (record[field] !== null && record[field] !== update[field])
          operations.removeId(update.id,
            operations.getUpdate(
              linkedType, record[field], relatedUpdates, idCache),
            inverseField, linkedIsArray)

        // After this point, there's no need to go over array operations.
        return
      }

      if (field in update.push)
        update.push[field].forEach(id => id !== null ?
          operations.addId(update.id,
            operations.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray) : null)

      if (field in update.pull)
        update.pull[field].forEach(id => id !== null ?
          operations.removeId(update.id,
            operations.getUpdate(linkedType, id, relatedUpdates, idCache),
            inverseField, linkedIsArray) : null)
    }))

    return Promise.all(Object.keys(relatedUpdates)
      .map(type => relatedUpdates[type].length ?
        transaction.update(type, relatedUpdates[type]) :
        Promise.resolve()))
  })

  .then(() => transaction.endTransaction())

  .then(() => {
    const eventData = {
      [type]: {
        [events.update]: updates.map(update => update[keys.primary])
      }
    }

    Object.keys(relatedUpdates).forEach(linkedType => {
      if (!relatedUpdates[linkedType].length) return
      if (!(linkedType in eventData)) eventData[linkedType] = {}
      if (linkedType !== type)
        eventData[linkedType][events.update] =
          relatedUpdates[linkedType].map(update => update[keys.primary])
      else
        // Get the union of update IDs.
        eventData[type][events.update] = [...union(
          eventData[type][events.update],
          relatedUpdates[type].map(update => update[keys.primary]))]
    })

    // Summarize changes during the lifecycle of the request.
    this.emit(events.change, eventData)

    return context
  })
}


// Get the union of arrays with unique values by means of the Set type.
function union () {
  return new Set(Array.prototype.reduce.call(arguments,
    (memo, array) => {
      memo.push(...array)
      return memo
    }, []))
}


// Validate updates.
function validateUpdates (updates, ids) {
  if (!updates.length)
    throw new errors.BadRequestError(
      `There are no valid updates in the request.`)

  updates.forEach(update => {
    if (!(keys.primary in update))
      throw new errors.BadRequestError(
        `The required field "${keys.primary}" on the update is missing.`)

    if (!~ids.indexOf(update[keys.primary]))
      throw new errors.BadRequestError(
        `An update is missing for at least one of the requested records.`)
  })
}
