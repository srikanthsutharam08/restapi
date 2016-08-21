var restify = require("restify");
var builder = require("botbuilder");
var Sequelize = require('sequelize');
var mysql = require('mysql');
var tedious = require('tedious')

//var env = process.env.NODE_ENV || 'development';
//var dbconfig = require('./config/dbconfig.json')[env];
//var sequelize = new Sequelize(dbconfig.database, dbconfig.username, dbconfig.password, dbconfig);

//-----------------
// local mysql DB
//-----------------
//var connection = mysql.createConnection({
//  host     : 'botdbserver.database.windows.net',
//  user     : 'root',
//  password : 'SbsUrrTai@#345',
//  database : 'botdb'
//});
//connection.connect();
//----------------------
//Connect to Azure mysql database
//----------------------
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;  
var TYPES = require('tedious').TYPES;
var config = {  
        userName: 'srikanthsutharam08',  
        password: 'SbsUrrTai@#345',  
        server: 'botdbserver.database.windows.net',  
        // When you connect to Azure SQL Database, you need these next options.  
        options: {encrypt: true, database: 'botdb'}  
    };  
var connection = new Connection(config);  
connection.on('connect', function(err) {  
    // If no error, then good to proceed.  
    console.log("Connected");
});
//----------------------

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

var profileInfo = {}
var name = null;
// Create chat bot
var botConnectorOptions = { 
    appId: process.env.BOTFRAMEWORK_APPID, 
    appPassword: process.env.BOTFRAMEWORK_APPSECRET
};
var connector = new builder.ChatConnector(botConnectorOptions);
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Activity Events
//=========================================================

bot.on('conversationUpdate', function (message) {
   // Check for group conversations
    if (message.address.conversation.isGroup) {
        // Send a hello message when bot is added
        if (message.membersAdded) {
            message.membersAdded.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                            .address(message.address)
                            .text("Hello everyone!");
                    bot.send(reply);
                }
            });
        }

        // Send a goodbye message when bot is removed
        if (message.membersRemoved) {
            message.membersRemoved.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                        .address(message.address)
                        .text("Goodbye");
                    bot.send(reply);
                }
            });
        }
    }
});

bot.on('contactRelationUpdate', function (message) {
    if (message.action === 'add') {
        var name = message.user ? message.user.name : null;
		profileInfo["name"] = name;
        var reply = new builder.Message()
                .address(message.address)
                .text("Hello %s... Thanks for adding me into your contacts.Say something for your information.", JSON.stringify(message) || 'there');
        bot.send(reply);
    } else {
        // delete their data
    }
});

bot.dialog('/', [
	function(session) {
		builder.Prompts.number(session, 'What is your age?');
    },
	function(session, results) {
		profileInfo["age"] = results.response;
		builder.Prompts.choice(session, 'What is your Gender?', ["Male","Female","Other"]);
    },
    function(session, results) {
		profileInfo["gender"] = results.response.entity;
		builder.Prompts.confirm(session, "Are you Married?");   
	}, 
    function (session, results) {
		profileInfo["maritalstatus"] = results.response;
		builder.Prompts.text(session, "What is your current residing city?");
	},
	function (session, results) {
		profileInfo["city"] = results.response; 
		//createProfileInfo(profileInfo)
		saveProfileInfo();
		session.endDialog(JSON.stringify(profileInfo));
	}
]);

function createProfileInfo(profileInfo) {
	var post = {name:profileInfo["name"], age:profileInfo["age"], gender:profileInfo["gender"], maritalstatus:profileInfo["maritalstatus"], city:profileInfo["city"]};	
	var query = connection.query('INSERT INTO userinfo SET ?', post, function(err, result) {
		if (err) 
			throw err;
	});
	console.log(query.sql);  
	connection.end();
}

function saveProfileInfo() {  
    var request = new Request("INSERT into dbo.userinfo(name, age, gender, maritalstatus, city) values (@name, @age, @gender, @maritalstatus, @city);", function(err) {  
		if (err) {  
			console.log(err);}  
        });  
        request.addParameter('name', TYPES.NVarChar, profileInfo["name"]);
		request.addParameter('age', TYPES.Int, profileInfo["age"]); 		
        request.addParameter('gender', TYPES.NVarChar , profileInfo["gender"]);  
		request.addParameter('maritalstatus', TYPES.Bit , profileInfo["maritalstatus"]);
        request.addParameter('city', TYPES.NVarChar , profileInfo["city"]);  
        request.on('row', function(columns) {  
            columns.forEach(function(column) {  
              if (column.value === null) {  
                console.log('NULL');  
              } else {  
                console.log("user inserted is " + column.value); 
              }  
            });  
        });       
        connection.execSql(request);	
}