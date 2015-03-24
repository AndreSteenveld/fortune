import keys from '../../schema/reserved_keys';
import enforce from '../../schema/enforcer';
import primaryKey from '../../common/primary_key';
import * as errors from '../../common/errors';
import * as arrayProxy from '../../common/array_proxy';


/*!
 * Extend context so that it includes the parsed records and create them.
 * This mutates the response object.
 *
 * @return {Promise}
 */
export default function (context) {
  let originalType = context.request._originalType;
  let originalIds = context.request._originalIds;
  let relatedField = context.request.relatedField;
  let isRelated = originalType && originalIds && relatedField;
  let isArray = originalType && relatedField ?
    this.schemas[originalType][relatedField][keys.isArray] : undefined;
  let type = context.request.type;
  let ids = context.request.ids;
  let records = this.serializer.parseCreate(context);
  let transaction, inverseField;
  let updates = {};

  if (!records.length)
    throw new errors.BadRequestError(
      `There are no valid records in the request.`);

  if (ids.length && !isRelated)
    throw new errors.BadRequestError(
      `Can not specify IDs in the request.`);

  if (isRelated) {
    inverseField = this.schemas[originalType][relatedField][keys.inverse];

    // Block request if there are too many records for the schema,
    // in the case of a to-one relationship.
    if (!isArray && records.length > 1)
      throw new errors.ConflictError(`Too many records requested to ` +
        `be created, only one allowed.`);

    // Block request if schema doesn't allow for to-many and multiple
    // original IDs are requested.
    if (!this.schemas[type][inverseField][keys.isArray] &&
      originalIds.length > 1)
        throw new errors.ConflictError(`Cannot specify multiple IDs for a ` +
          `to-one relationship.`);

    // Block request if the inverse of the related field is specified.
    if (arrayProxy.find(records, record => record.hasOwnProperty(inverseField)))
      throw new errors.ConflictError(`Cannot specify the inverse field ` +
        `"${inverseField}" on the record if related field is specified.`);
  }

  return Promise.all(records.map(record => {
    // Enforce the schema before running transform.
    record = enforce(record, this.schemas[type]);

    // Attach related field.
    if (isRelated)
      record[inverseField] = this.schemas[type][inverseField]
        [keys.isArray] ? originalIds : originalIds[0];

    // Do before transforms.
    return new Promise(resolve => resolve(
      (this.transforms[type] || {}).hasOwnProperty('before') ?
        this.transforms[type].before(context, record) : record));
  }))
  .then(transformedRecords =>
    this.adapter.beginTransaction().then(t => {
      transaction = t;
      return transaction.create(type, transformedRecords);
    }
  ))
  .then(createdRecords => {
    // Adapter must return something.
    if (!createdRecords.length)
      throw new errors.BadRequestError(`Records could not be created.`);

    // Each created record must have an ID.
    if (arrayProxy.find(createdRecords, record =>
      !record.hasOwnProperty(primaryKey)))
      throw new Error(`ID on created record is missing.`);

    // Update inversely linked records on created records.
    // This is not quite easy, trying to batch updates to be
    // as few as possible.
    let schema = this.schemas[type];
    let links = schema._links;
    let idCache = {};

    // Do some initialization.
    links.forEach(field => {
      if (schema[field][keys.inverse]) {
        let linkedType = schema[field][keys.link];
        updates[linkedType] = [];
        idCache[linkedType] = new Set();
      }
    });

    // Loop over each record to generate updates object.
    createdRecords.forEach(record => {
      links.forEach(field => {
        let inverseField = schema[field][keys.inverse];

        if (record.hasOwnProperty(field) && inverseField) {
          let linkedType = schema[field][keys.link];
          let linkedIsArray = this.schemas[linkedType]
            [inverseField][keys.isArray];
          let linkedIds = Array.isArray(record[field]) ?
            record[field]: [record[field]];

          linkedIds.forEach(id => {
            let update;

            if (idCache[linkedType].has(id)) {
              update = arrayProxy.find(updates[linkedType],
                update => update.id === id);
            } else {
              update = { id: id };
              updates[linkedType].push(update);
              idCache[linkedType].add(id);
            }

            if (linkedIsArray) {
              update.add = update.add || {};
              update.add[inverseField] = update.add[inverseField] || [];
              update.add[inverseField].push(record[primaryKey]);
            } else {
              update.replace = update.replace || {};
              update.replace[inverseField] = record[primaryKey];
            }
          });
        }
      });
    });

    return Promise.all(Object.keys(updates).map(type =>
      updates[type].length ?
        transaction.update(type, updates[type]) :
        Promise.resolve([])
    ));
  })
  .then(() => transaction.endTransaction())
  .then(() => {
    context.response.payload.records = records;

    // Summarize changes during the lifecycle of the request.
    this.emit(this._changeEvent, Object.assign({
      [type]: {
        create: records.map(record => record[primaryKey])
      }
    }, Object.keys(updates).reduce((types, type) => {
      types[type] = {
        update: updates[type].map(update => update.id)
      };

      return types;
    }, {})));

    return context;
  });
}
