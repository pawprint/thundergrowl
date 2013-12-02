var growlgntp = function () {

	var growl = Components.classes['@growlforwindows.com/growlgntp;1'].getService().wrappedJSObject;
	var isThunderbird = true;
	var isPostbox = false;

	function init() {
		try {
			if (!growl.isInitialized) {
				growl.init();

				// add mail listener
				var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"].getService(Components.interfaces.nsIMsgFolderNotificationService);
				notificationService.addListener(newMailListener, 1);

        const mfn = Components.interfaces.nsIMsgFolderNotificationService;
        MailServices.mfn.addListener(classifiedMailListener, mfn.msgsClassified);

				// override default notifications
				var oPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				oPrefs.setBoolPref("mail.biff.show_alert", false);
			}
			// register
			growlgntp.register();

			growl.addClickCallbackHandler(growlgntp.clickCallbackHandler);
		}
		catch (e) {
			Components.utils.reportError("growlgntp-thunderbird EXCEPTION: " + e.toString());
		}
	};

	function processQueue(queue) {
		try {
			while (queue.length > 0) {
				var notification = queue.pop();
				doNotification(notification.type, notification.title, notification.message, notification.callbackContext, notification.callbackType, notification.priority);
			}
		}
		catch (e) {
			Components.utils.reportError("growlgntp-thunderbird EXCEPTION: " + e.toString());
		}
	};

	function doNotification(type, title, message, callbackContext, callbackType, priority) {
		growl.notify(growlgntp.APPNAME, type, title, message, callbackContext, callbackType, priority);
	};

  let classifiedMailListener = {
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIMsgFolderListener]),
    msgsClassified: function(aMsgs, aJunkProcessed, aTraitProcessed) {
      for each (let msg in fixIterator(aMsgs.enumerate(), Components.interfaces.nsIMsgDBHdr)){
        processNewItem(null, msg);
      }
    }
  };

	var newMailListener = {
		itemAdded: function (item) {
			processNewItem(item);
		}
	};

	function processNewItem(item, pMsg) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("growlgntp-thunderbird.");
    var vState = "Added";
    var msg = null;
		try {
      if (item != null) {
			  msg = item.QueryInterface(Components.interfaces.nsIMsgDBHdr);
      }else{
        vState = "Classified";
        msg = pMsg;
      }
			if (msg.isRead) return;

      var folder = msg.folder;
      //var junkscore = msg.getStringProperty("junkscore");

      //if(junkscore > 50) return;
      if(folder.isSpecialFolder((nsMsgFolderFlags.Drafts|nsMsgFolderFlags.Trash|nsMsgFolderFlags.Junk|nsMsgFolderFlags.Sent), false)) return;

			var uri = msg.folder.getUriForMsg(msg);

			if (growlgntp.isRss(msg.messageId)) {
				if (growlgntp.newrsstimer) window.clearTimeout(growlgntp.newrsstimer);

				var author = msg.folder.prettiestName;
				var regex = /^<([^>]*)>/;
				var match = regex.exec(author);
				if (match) author = match[1];

				growlgntp.rssqueue.push({ type: "newrss", title: "New Post: "+folder.prettiestName+": ", message: msg.mime2DecodedSubject, callbackContext: uri, callbackType: "rss" });
				growlgntp.newrsstimer = window.setTimeout(growlgntp.processRssQueue, 1000);
			}else {
				if (growlgntp.newmailtimer) window.clearTimeout(growlgntp.newmailtimer);

				var author = msg.mime2DecodedAuthor;
        var subject = msg.mime2DecodedSubject;

        var regex = /<([^>]*)>|"*([^<>"]*)/;
        var match = regex.exec(author);

dump("growl: Applying Filters");
        try {
          if(prefs.prefHasUserValue("folderregexpref")) {
            var rxFolder  = prefs.getCharPref("folderregexpref");
            if(rxFolder) {
  dump("growl: Folders Filter "+rxFolder);
              var rxpFolder = new RegExp(rxFolder);
              if(rxpFolder.exec(folder.prettiestName)) return;
            }
          }

          if(prefs.prefHasUserValue("senderregexpref")) {
            var rxSender  = prefs.getCharPref("senderregexpref");
            if(rxSender) {
  dump("growl: Filtering Senders "+rxSender);
              var rxpSender = new RegExp(rxSender);
              if(rxpSender.exec(author)) return;
            }
          }

          if(prefs.prefHasUserValue("subjectregexpref")) {
            var rxSubject = prefs.getCharPref("subjectregexpref");
            if(rxSubject) {
  dump("growl: Filtering Subjects "+rxSubject);
              var rxpSubject = new RegExp(rxSubject);
              if(rxpSubject.exec(subject)) return;
            }
          }
        } catch(e) {
          dump(e);
        }

				if (match) author = match[1] || match[2];

				// Thunderbird priorities 0 & 1 are treated as 'normal'
				var priority = 0;
				if (msg.priority >= 2) {
					priority = msg.priority - 4;    // Thunderbird values are 2 thru 6, Growl values are -2 thru 2
				}

				growlgntp.mailqueue.push({ type: "newmail", title: "New Email: "+folder.prettiestName, message: "From: "+author+". "+subject, priority: priority, callbackContext: uri, callbackType: "mail" });
				growlgntp.newmailtimer = window.setTimeout(growlgntp.processMailQueue, 1000);
			}
		}
		catch (e) {
			Components.utils.reportError("growlgntp-thunderbird EXCEPTION: " + e.toString());
		};
	};

	return {
		newmailtimer: null,
		newrsstimer: null,
		mailqueue: [],
		rssqueue: [],

		APPNAME: "Thunderbird",

		register: function () {
			try {
				var id = "growlgntp-thunderbird@brian.dunnington";

				var extensionPath = "";

				var extman = Components.classes["@mozilla.org/extensions/manager;1"];
				if (extman) {
					// get the extension path
					var extension = Components.classes["@mozilla.org/extensions/manager;1"]
									.getService(Components.interfaces.nsIExtensionManager)
									.getInstallLocation(id)
									.getItemLocation(id);
					var extensionPath = extension.path;

					// figure out which app we are talking about
					var appname = "Thunderbird";
					var icon = extensionPath + "\\chrome\\content\\thunderbird.png";

					var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
					switch (appInfo.ID) {
						case "postbox@postbox-inc.com":
							appname = "Postbox";
							var icon = extensionPath + "\\chrome\\content\\postbox.png";
							isThunderbird = false;
							isPostbox = true;
							break;
					};
					growlgntp.APPNAME = appname;

					var ntNewMail = { Name: 'newmail', DisplayName: 'New Mail Arrived' };
					var ntNewRSS = { Name: 'newrss', DisplayName: 'New RSS Item' };

					var notificationTypes = [ntNewMail, ntNewRSS];
					growl.register(growlgntp.APPNAME, icon, notificationTypes);
				} else {
					Components.utils.import("resource://gre/modules/AddonManager.jsm");
					AddonManager.getAddonByID("growlgntp-thunderbird@brian.dunnington", function (addon) {
						var fakeFile = addon.getResourceURI("fake.fak").asciiSpec;
						var extensionPath = fakeFile.replace("fake.fak", "");

						// figure out which app we are talking about
						var appname = "Thunderbird";
						var icon = extensionPath + "\\chrome\\content\\thunderbird.png";

						var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
						switch (appInfo.ID) {
							case "postbox@postbox-inc.com":
								appname = "Postbox";
								isThunderbird = false;
								isPostbox = true;
								var icon = extensionPath + "\\chrome\\content\\postbox.png";
								break;
						};
						growlgntp.APPNAME = appname;

						var ntNewMail = { Name: 'newmail', DisplayName: 'New Mail Arrived' };
						var ntNewRSS = { Name: 'newrss', DisplayName: 'New RSS Item' };

						var notificationTypes = [ntNewMail, ntNewRSS];
						growl.register(growlgntp.APPNAME, icon, notificationTypes);
					});
				}
			}
			catch (e) {
				Components.utils.reportError("growlgntp-thunderbird EXCEPTION: " + e.toString());
			}
		},

		processMailQueue: function () {
			try {
				var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				var groupAfter = prefs.getIntPref("growlgntp-thunderbird.maxmailnotifications");

				if (growlgntp.mailqueue.length > groupAfter) {
					doNotification("newmail", "New Mail", "You have " + growlgntp.mailqueue.length + " new emails.", growlgntp.mailqueue.length, "mailsummary");
					growlgntp.mailqueue = [];
				}
				else {
					processQueue(growlgntp.mailqueue);
				}
				growlgntp.newmailtimer = null;
			}
			catch (e) {
				Components.utils.reportError("growlgntp-thunderbird EXCEPTION: " + e.toString());
			}
		},

		processRssQueue: function () {
			try {
				var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				var groupAfter = prefs.getIntPref("growlgntp-thunderbird.maxrssnotifications");

				if (growlgntp.rssqueue.length > groupAfter) {
					doNotification("newrss", "New Feed Items", "You have " + growlgntp.rssqueue.length + " new feed items.", growlgntp.rssqueue.length, "rsssummary");
					growlgntp.rssqueue = [];
				}
				else {
					processQueue(growlgntp.rssqueue);
				}
				growlgntp.newrsstimer = null;
			}
			catch (e) {
				Components.utils.reportError("growlgntp-thunderbird EXCEPTION: " + e.toString());
			}
		},

		isRss: function (id) {
			if (!id || id[0] != 'h' || id.length < 7) {
				return false;
			}
			else {
				return ((id.substring(0, 6) == "http:/") || (id.substring(0, 7) == "https:/"));
			}
		},

		clickCallbackHandler: function (data) {
			var messenger = Components.classes["@mozilla.org/messenger;1"].createInstance();
			messenger = messenger.QueryInterface(Components.interfaces.nsIMessenger);

			if (data.type == "mail" || data.type == "rss") {
				var messageUri = data.context;
				var msgHdr = messenger.msgHdrFromURI(messageUri);

				var newWindow;
				if (isPostbox)
					newWindow = window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank", "chrome,all,dialog=no", messageUri, msgHdr.folder.folderURL, GetDBView());
				else
					var newWindow = window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank", "chrome,all,dialog=no", msgHdr);
				newWindow.focus();
			}
			else {
				var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
				var recentWindow = windowMediator.getMostRecentWindow("mail:3pane");
				if (recentWindow) recentWindow.focus();
			}
		},

		onLoad: function () {
			this.strings = document.getElementById("growlgntp-strings");
			init();
		},

		sendTest: function () {
			doNotification("newmail", "Growl Test", "This is a test notification from " + growlgntp.APPNAME);
		}
	}
} ();
window.addEventListener("load", function(e) { growlgntp.onLoad(e); }, false);
dump("growlgntp-thunderbird is loading");
