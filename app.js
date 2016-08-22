var restify = require("restify");
var builder = require("botbuilder");
var mysql = require('mysql');
var tedious = require('tedious')

//-----------------
// Azure mysql DB
//-----------------
var connection = mysql.createConnection({
  host     : 'us-cdbr-azure-west-c.cloudapp.net',
  user     : 'b53b72110e4c63',
  password : '38210b5d',
  database : 'acsm_b33ab7b73a67497'
});
connection.connect();

//----------------------
//Connect to Azure sql server database
//----------------------
//var Connection = require('tedious').Connection;
//var Request = require('tedious').Request;  
//var TYPES = require('tedious').TYPES;
//var config = {  
//        userName: 'srikanthsutharam08',  
//        password: 'SbsUrrTai@#345',  
//       server: 'botdbserver.database.windows.net',  
//        // When you connect to Azure SQL Database, you need these next options.  
//        options: {encrypt: true, database: 'botdb'}  
//    };  
//var connection = new Connection(config);  
//connection.on('connect', function(err) {  
    // If no error, then good to proceed.  
//    console.log("Connected");
//});
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
		var user_id = message.user.id
		profileInfo["name"] = name;
		profileInfo["user_id"] = user_id;
        var reply = new builder.Message()
                .address(message.address)
                .text("Hello %s... Thanks for adding me into your contacts.Say something.", name || 'there');
        bot.send(reply);
    } else {
        //deleteProfileInfo(message.user.id)
		deleteUserInfo(message.user.id)
    }
});


// Bot Dialogs
bot.dialog('/', [
	function(session) {
		if(profileInfo["age"]) {
			session.send(JSON.stringify(profileInfo))
		} else {
			session.beginDialog('/profileInfo')
		}
    }
]);

bot.dialog('/profileInfo', [
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
		saveUserInfo(profileInfo)
		deleteUserInfo(profileInfo["user_id"])
		//saveProfileInfo();
		session.endDialog(JSON.stringify(profileInfo));
	}
])

//Save userinfo in SQL DB
function saveUserInfo(profileInfo) {
 	var post = {user_id:profileInfo["user_id"], user_name:profileInfo["name"], age:profileInfo["age"], gender:profileInfo["gender"], maritalstatus:profileInfo["maritalstatus"], city:profileInfo["city"]};	
 	var query = connection.query('INSERT INTO userinfo SET ?', post, function(err, result) {
 		if (err) 
 			throw err;
 	});
 	console.log(query.sql);  
 	connection.end();
}

//Delete userinfo in SQL DB
function deleteUserInfo(user_id) {
 	var post = {user_id:profileInfo["user_id"]};	
 	var query = connection.query('delete from userinfo where ?', post, function(err, result) {
 		if (err) 
 			throw err;
 	});
 	console.log(query.sql);  
 	connection.end();
}

//Save the userdata in SQL server DB
function saveProfileInfo() {  
    var request = new Request("INSERT into dbo.userinfo(user_id, user_name, age, gender, maritalstatus, city) values (@user_id, @name, @age, @gender, @maritalstatus, @city);", function(err) {  
		if (err) {  
			console.log(err);}  
        });  
		request.addParameter('user_id', TYPES.NVarChar, profileInfo["user_id"]);
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

//Delete the userdata in SQL server DB
function deleteProfileInfo(userId) {  
    var request = new Request("delete from dbo.userinfo where user_id = @user_id;", function(err) {  
		if (err) {  
			console.log(err);}  
        });  
		request.addParameter('user_id', TYPES.NVarChar, userId);       
        connection.execSql(request);	
}