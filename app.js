var restify = require("restify");
var builder = require("botbuilder");
var urlencode = require('urlencode');
var Client = require('node-rest-client').Client;
var client = new Client();

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.use(restify.bodyParser());
server.use(restify.jsonp());
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

var survey_data = {}
var profileQtObj;
// Create chat bot
var botConnectorOptions = { 
    appId: process.env.BOTFRAMEWORK_APPID, 
    appPassword: process.env.BOTFRAMEWORK_APPSECRET
};
var connector = new builder.ChatConnector(botConnectorOptions);
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

server.post('/pushsurvey', function respond(req, res, next) {
	var inputsurveydata = req.body
	var filteredUsers = inputsurveydata.users
//	var filteredUsers = [{"id":"d2b794f47f8f41aeb6f659bf1cfbee3a","channelId":"emulator","user":{"id":"617d3bf8","name":"User1"},"conversation":{"isGroup":false,"id":"1cf91be5","name":"Conv1"},"bot":{"id":"5e4f5dfa","name":"Bot1"},"serviceUrl":"http://localhost:9000","useAuth":false}]


//var filteredUsers = [{"id":"JVuBqSefc9x","channelId":"skype","user":{"id":"29:1vUMyT4wHzcOL4Y-HjK84ehrKSYjtrqgC6Fr-809jV24","name":"Jayaram Reddy Y"},"conversation":{"id":"29:1vUMyT4wHzcOL4Y-//HjK84ehrKSYjtrqgC6Fr-809jV24"},"bot":{"id":"28:c1bb3e1e-5cbd-4204-8e2c-2b45b569910a","name":"fissionmrbot"},"serviceUrl":"https://skype.botframework.com","useAuth":true}]

	if(filteredUsers && (filteredUsers.length > 0)) {
		filteredUsers.forEach(function(address){
			var userId = address.user.id
			if(!survey_data[userId]) {
				survey_data[userId] = {}
			}
			survey_data[userId] = {"surveyId":inputsurveydata.surveyId, "proposer": inputsurveydata.proposer, "surveyname":inputsurveydata.surveyname,"surveyquestion": inputsurveydata.surveyquestion}
			bot.beginDialog(address, '/notify');
		});
	}
 	
 	res.send('Sent survey requests to end users::'+JSON.stringify(req.body));
});

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
		bot.beginDialog(message.address, '/profileInfo');
    } else {
        //deleteProfileInfo(message.user.id)
    }
});


// Bot Dialogs
bot.dialog('/', [
	function(session) {
		session.beginDialog('/profileInfo')
    }
]);

bot.dialog('/profileInfo', [
	function(session) {
		session.privateConversationData.userId = session.message.user.id
		var name = session.message.user ? session.message.user.name : null
		session.privateConversationData.name = name
		session.privateConversationData.address = session.message.address
		builder.Prompts.number(session, 'Hello %s... Thanks for adding me into your contacts. Please fill out the basic profile info. What is your age?', name);
	},
	function(session, results) {
		session.privateConversationData.age = results.response;
		builder.Prompts.choice(session, 'What is your Gender?', ["Male","Female","Other"]);
    },
    function(session, results) {
		session.privateConversationData.gender = results.response.entity;
		builder.Prompts.confirm(session, "Are you Married?");   
	}, 
    function (session, results) {
		session.privateConversationData.maritalstatus = results.response;
		builder.Prompts.text(session, "Please enter your email id?");
	}, 
    function (session, results) {
		session.privateConversationData.email = urlencode(results.response);
		builder.Prompts.text(session, "What is your current residing city?");
	},
	function (session, results) {
		session.privateConversationData.city = results.response;
		session.privateConversationData.infoGathered = "true";
		saveProfileInfo(session.privateConversationData)
		session.endDialog(JSON.stringify(session.privateConversationData));
	}
]);


bot.dialog('/notify', [
	function(session) {
		builder.Prompts.confirm(session, "Hii, We have a new "+ survey_data[session.message.user.id]["surveyname"] +
					" Survey conducted by "+ survey_data[session.message.user.id]["proposer"] +".Do you want to participate?");
	},
	function(session, results) {
		if(results.response){
			session.beginDialog('/survey');
		} else {
			session.endDialog("Thank You for your time :)");
		}
	}
]);

bot.dialog('/survey', [
    function (session) {
		askQuestion(session);
    },
    function (session, results) {
		session.endDialog("Response::"+ JSON.stringify(results.response.entity));
    }
]);

//=========================================================
// User Functions
//=========================================================

function askQuestion(session) {
	var surveyQuestion = survey_data[session.message.user.id]["surveyquestion"]
	if(surveyQuestion.type === 'multi') {
        builder.Prompts.choice(session, surveyQuestion.question, surveyQuestion.choices);
    } else if (surveyQuestion.type === 'bool') {
        builder.Prompts.confirm(session, surveyQuestion.question);
    } else if (surveyQuestion.type === 'text') {
        builder.Prompts.text(session, surveyQuestion.question);
    }
}

/**
Sends profile Information to Server.
**/
function saveProfileInfo(profileInfo){

	console.log("Pushing profile information back to server");
	var args = {
		parameters: { userId: profileInfo["userId"], userName: profileInfo["name"], address: profileInfo["address"], age: profileInfo["age"], gender : profileInfo["gender"], maritalstatus: profileInfo["maritalstatus"], email: profileInfo["email"], city: profileInfo["city"], infoGathered: profileInfo["infoGathered"] },
		headers: { "Content-Type": "application/x-www-form-urlencoded" }
	};
	//direct way 
	client.post("http://localhost:9090/StudentEnrollmentWithREST/webapi/studentResource/saveinfo",args, function (data, response) {
		//console.log(response);
	});
}


/**
Returns list of end users after filtering
**/
function filterUsers(profileInfo) {
	return profileInfo
}
