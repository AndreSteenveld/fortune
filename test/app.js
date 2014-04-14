var fortune = require('../lib/fortune');

function createApp(adapter, options, port) {

  var app = fortune(options);

  app.inflect.inflections.plural("MOT", "MOT");

  if (app.adapter.mongoose) {
    app.adapter.awaitConnection().then(function() {
      console.log('Dropping database');
      app.adapter.mongoose.connections[1].db.dropDatabase();
    });
  }

  app.router.post("/remove-pets-link/:personid", function(req, res) {
    var Person = app.adapter.model("person");
    Person.findOne({email: req.params.personid}, function(err,person) {
      if (err) {
        console.error(err);
        res.send(500,err);
        return;
      }
      person.pets = null;
      person.save(function() {
        res.send(200);
      });
    });

  });

  return app.resource('person', {
    name: String,
    appearances: Number,
    email: String,
    pets: ['pet'],
    soulmate: {ref: 'person', inverse: 'soulmate', pkType: String},
    lovers: [{ref: 'person', inverse: 'lovers', pkType: String}],
    externalResources: [{ ref: "externalResourceReference", pkType: String, external: true }]
  }, {model: {pk:"email"}})

  .resource('pet', {
    name: String,
    appearances: Number,
    owner: {ref:'person', pkType: String}
  })

  .resource('car', {
    licenseNumber: String,
    model: String,
    owner: {ref:'person', pkType: String},
    MOT: {ref: 'MOT', external: true, pkType: String}
  },{ model: { pk: "licenseNumber" } })

  .after('person', function() {
    this.nickname = 'Super ' + this.name;
    return this;
  })

  .after('person', function() {
    this.nickname = this.nickname + '!';
    return this;
  })

  .listen(port);

}

module.exports = createApp;
