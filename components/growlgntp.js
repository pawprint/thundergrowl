/***********************************************************
constants
***********************************************************/

// UUID uniquely identifying our component
const CLASS_ID = Components.ID("{98405d40-3a60-11de-8a39-0800200c9a66}");

// description
const CLASS_NAME = "Growl/GNTP XPCOM Component";

// textual unique identifier
const CONTRACT_ID = "@growlforwindows.com/growlgntp;1";

/***********************************************************
class definition
***********************************************************/

//class constructor
function Growl() {
    // If you only need to access your component from Javascript, uncomment the following line:
    this.wrappedJSObject = this;
};

// class definition
Growl.prototype = {

    isInitialized : false,

    eventTarget : null,

    init : function(){
        try{
            this.isInitialized = true;
            var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
            observerService.addObserver(this, "growlgntpclickcallback", false);

            try{
                // Thunderbird 2.*
                var eventQueueService = Components.classes["@mozilla.org/event-queue-service;1"].getService(Components.interfaces.nsIEventQueueService);
                this.eventTarget = eventQueueService.getSpecialEventQueue(Components.interfaces.nsIEventQueueService.UI_THREAD_EVENT_QUEUE);
            }
            catch(e){
                // Thunderbird 3.*
                this.eventTarget = Components.classes["@mozilla.org/thread-manager;1"].getService(Components.interfaces.nsIThreadManager).mainThread;
            }

            this.socketReadCallback.eventTarget = this.eventTarget;
        }
        catch(e){
            Components.utils.reportError(e);
        }
    },

    observe : function(aSubject, aTopic, aData){
        switch (aTopic) {
            case "growlgntpclickcallback" :
				var data = JSON.parse(aData);
                for(var i=0;i<this.clickCallbackHandlers.length;i++){
                    this.clickCallbackHandlers[i](data);
                }
                break;
        }
    },

    register: function(appName, appIcon, notificationTypes) {
        var data = "GNTP/1.0 REGISTER NONE\r\n" +
                   "Application-Name: " + appName + "\r\n" +
                   "Application-Icon: " + appIcon + "\r\n" +
                   "Notifications-Count: " + notificationTypes.length + "\r\n" +
                   "\r\n";
                   for(var i=0;i<notificationTypes.length;i++){
                        var nt = notificationTypes[i];
                        data += "Notification-Name: " + nt.Name + "\r\n" +
                                "Notification-Display-Name: " + nt.DisplayName + "\r\n" +
                                "Notification-Enabled: True\r\n" +
                                "\r\n";
                   }
        this.send(data);
    },

    notify: function(appName, type, title, message, callbackData, callbackType, priority){
        var waitForCallback = false;
        var data = "GNTP/1.0 NOTIFY NONE\r\n" +
                   "Application-Name: " + appName + "\r\n" +
                   "Notification-Name: " + type + "\r\n" +
                   "Notification-Title: " + title + "\r\n" +
                   "Notification-Text: " + message + "\r\n";
        if(priority){
            data += "Notification-Priority: " + priority.toString() + "\r\n";
        }
        if(callbackData){
            waitForCallback = true;
            data += "Notification-Callback-Context: " + callbackData + "\r\n" +
                    "Notification-Callback-Context-Type: " + callbackType + "\r\n";
        }
        data += "\r\n";
        this.send(data, waitForCallback);
    },

    send : function(data, waitForCallback){
        try{
            // at first, we need a nsISocketTransportService ....
            var transportService =
                Components.classes["@mozilla.org/network/socket-transport-service;1"]
                  .getService(Components.interfaces.nsISocketTransportService);

            var socket = transportService.createTransport(null, 0, "localhost", 23053, null);
            //socket.setTimeout(socket.TIMEOUT_READ_WRITE, 2);
            var stream = socket.openOutputStream(0, 0, 0);

            var bytes = this.stringToBytes(this.utf8encode(data));

            var binstream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
            binstream.setOutputStream(stream);
            binstream.writeByteArray(bytes, bytes.length);

            if(waitForCallback){
                var input = socket.openInputStream(0, 0, 0);
                input.QueryInterface(Components.interfaces.nsIAsyncInputStream);
                input.asyncWait(this.socketReadCallback, 0, 0, this.eventTarget);
                this.waitingSockets.push(socket);
            }
            else{
                binstream.close();
                //socket.close(0); TODO: this causes the data to not be written for some reason
            }
        }
        catch(e){
			Components.utils.reportError(e);
        }
    },

    socketReadCallback : {
        eventTarget : null,

        onInputStreamReady : function(stream){
            try{
                var bis = Components.classes["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Components.interfaces.nsIBinaryInputStream);
                bis.setInputStream(stream);

                var bytes = bis.readByteArray(bis.available());
                var str = String.fromCharCode.apply(null, bytes);

				//Components.utils.reportError(str);

                // if OK, then wait again
                // if ERROR, we are done
                // if CALLBACK, check for CLICK and notify (and we are done)
                if(str.indexOf("GNTP/1.0 -OK") == 0){
                    stream.asyncWait(this, 0, 0, this.eventTarget);
                }
                else if(str.indexOf("GNTP/1.0 -ERROR") == 0){
                    // close socket somehow
                }
                else if(str.indexOf("GNTP/1.0 -CALLBACK") == 0 && str.indexOf("Notification-Callback-Result: CLICK") > 0){
                    var context = "";
                    var regex1 = /[\s\S]*Notification-Callback-Context: ([^\r]*)/;
                    var match1 = regex1.exec(str);
                    if(match1) context = match1[1];
                    var regex2 = /[\s\S]*Notification-Callback-Context-Type: ([^\r]*)/;
                    var match2 = regex2.exec(str);
                    if(match2) type = match2[1];
                    // notify observers of callback
                    Components.classes["@mozilla.org/observer-service;1"]
                        .getService(Components.interfaces.nsIObserverService)
                        .notifyObservers(null, "growlgntpclickcallback", "{\"context\":\"" + context + "\",\"type\":\"" + type + "\"}");
                }
                else{
                }
            }
            catch (e) {
                //Stream closes automatically this is normal
                //Components.utils.reportError(e);
            }
        }
    },

    stringToBytes : function ( str ) {
       var ch, st, re = [];
       for (var i = 0; i < str.length; i++ ) {
               ch = str.charCodeAt(i); // get char
               st = []; // set up "stack"
               do {
                   st.push( ch & 0xFF ); // push byte to stack
                   ch = ch >> 8; // shift value down by 1 byte
               }
               while ( ch );
               // add stack contents to result
               // done because chars have "wrong" endianness
               re = re.concat( st.reverse() );
       }
       // return an array of bytes
       return re;
    },

    /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
    /*  From: AES implementation in JavaScript (c) Chris Veness 2005-2010                             */
    /*   - http://www.movable-type.co.uk/scripts/aes.html                                             */
    /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
    /* Encode multi-byte Unicode string into utf-8 multiple single-byte characters
     * Chars in range U+0080 - U+07FF are encoded in 2 chars, U+0800 - U+FFFF in 3 chars */
    utf8encode : function(strUni) {
      var strUtf = strUni.replace(
          /[\u0080-\u07ff]/g,  // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
          function(c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xc0 | cc>>6, 0x80 | cc&0x3f); }
        );
      strUtf = strUtf.replace(
          /[\u0800-\uffff]/g,  // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
          function(c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xe0 | cc>>12, 0x80 | cc>>6&0x3F, 0x80 | cc&0x3f); }
        );
      return strUtf;
    },

    waitingSockets : [],

    clickCallbackHandlers : [],

    addClickCallbackHandler : function(handler){
        this.clickCallbackHandlers.push(handler);
    },

    QueryInterface: function(aIID)
    {
        if (!aIID.equals(Components.interfaces.nsISupports))
            throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
    }
};

/***********************************************************
class factory

This object is a member of the global-scope Components.classes.
It is keyed off of the contract ID. Eg:

growl = Components.classes["@growlforwindows.com/growlgntp;1"].
                          createInstance(Components.interfaces.nsIHelloWorld);

***********************************************************/
var GrowlFactory = {
  createInstance: function (aOuter, aIID)
  {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return (new Growl()).QueryInterface(aIID);
  }
};

/***********************************************************
module definition (xpcom registration)
***********************************************************/
var GrowlModule = {
  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType)
  {
    aCompMgr = aCompMgr.
        QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME,
        CONTRACT_ID, aFileSpec, aLocation, aType);
  },

  unregisterSelf: function(aCompMgr, aLocation, aType)
  {
    aCompMgr = aCompMgr.
        QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);
  },

  getClassObject: function(aCompMgr, aCID, aIID)
  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return GrowlFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(aCompMgr) { return true; }
};

/***********************************************************
module initialization

When the application registers the component, this function
is called.
***********************************************************/
function NSGetModule(aCompMgr, aFileSpec) { return GrowlModule; }

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
function NSGetFactory(cid) { return GrowlFactory; }