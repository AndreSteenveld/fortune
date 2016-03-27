'use strict'

var genericMessage = 'GenericError'

module.exports = message


/**
 * Message function for i18n.
 *
 * @param {String} id
 * @param {String} language
 * @param {Object} [data]
 * @return {String}
 */
function message (id, language, data) {
  var str, key

  // Assign fallback language to "en".
  if (!language || !(language in message))
    language = 'en'

  if (!(id in message[language]))
    return message[language][genericMessage] || message.en[genericMessage]

  str = message[language][id]

  for (key in data) str = str.replace('{' + key + '}', data[key])

  return str
}


// Default language messages.
/* eslint-disable max-len */
message.en = {
  'GenericError': 'An internal error occurred.',

   // Various errors.
  'MalformedRequest': 'The request was malformed.',
  'InvalidBody': 'The request body is invalid.',
  'SerializerNotFound': 'The serializer for "{id}" does not exist.',
  'InputOnly': 'Input only.',
  'InvalidID': 'An ID is invalid.',
  'DateISO8601': 'Date string must be an ISO 8601 formatted string.',
  'DateInvalid': 'Date value is invalid.',
  'BufferEncoding': 'Buffer value must be a {bufferEncoding}-encoded string.',
  'JSONParse': 'Could not parse value as JSON.',
  'MissingPayload': 'Payload is missing.',
  'SpecifiedIDs': 'IDs should not be specified.',
  'InvalidURL': 'Invalid URL.',
  'RelatedRecordNotFound': 'A related record for the field "{field}" was not found.',
  'CreateRecordsInvalid': 'There are no valid records to be created.',
  'CreateRecordsFail': 'Records could not be created.',
  'CreateRecordMissingID': 'An ID on a created record is missing.',
  'DeleteRecordsInvalid': 'There are no records to be deleted.',
  'UnspecifiedType': 'The type is unspecified.',
  'InvalidType': 'The requested type "{type}" is not a valid type.',
  'InvalidMethod': 'The method "{method}" is unrecognized.',
  'CollisionToOne': 'Multiple records can not have the same to-one link value on the field "{field}".',
  'CollisionDuplicate': 'Duplicate ID "{id}" in the field "{field}".',
  'UpdateRecordMissing': 'The record to be updated could not be found.',
  'UpdateRecordsInvalid': 'There are no valid updates.',
  'UpdateRecordMissingID': 'An ID on an update is missing.',
  'EnforceArrayType': 'The value of "{key}" is invalid, it must be an array with values of type "{type}".',
  'EnforceArray': 'The value of "{key}" is invalid, it must be an array.',
  'EnforceSameID': 'An ID of "{key}" is invalid, it cannot be the same ID of the record.',
  'EnforceSingular': 'The value of "{key}" can not be an array, it must be a singular value.',
  'EnforceValue': 'The value of "{key}" is invalid, it must be a "{type}".',
  'EnforceValueArray': 'A value in the array of "{key}" is invalid, it must be a "{type}".',
  'FieldsFormat': 'Fields format is invalid. It may either be inclusive or exclusive, but not both.',
  'RecordExists': 'A record with ID "{id}" already exists.',

  // Used for HTML serializer.
  'Index': 'Index',
  'Type': 'Type',
  'Include': 'Include',
  'QueryOptions': 'Query Options',
  'IncludedLabel': 'included',
  'NoResults': 'No results.',
  'Actions': 'Actions',
  'Create': 'Create',
  'Update': 'Update',
  'Delete': 'Delete',
  'True': 'True',
  'False': 'False',
  'IncludePath': 'Path (dot-separated)',
  'Query': 'Query',
  'Fields': 'Fields',
  'Match': 'Match',
  'Sort': 'Sort',
  'Field': 'Field',
  'Pagination': 'Pagination',
  'Limit': 'Limit',
  'Offset': 'Offset'
}
/* eslint-enable max-len */
