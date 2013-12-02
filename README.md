ThunderGrowl
============

Updated Growl Extension for Thunderbird - This extension was forked from the work of brian dunnington part of the growl for windows addons site.

I found it much in need of a few enhancements and work on it seemed to have stopped so I'm taking the jump to try and contribute. The main goals of this project are as follows:

+  Ensure the extension remains compatible with Thunderbird releases
+  Prevent growling messages classified as Junk
+  Allow message filters to run before growling
+  Allow some level of folder/sender/subject filtering
+  Allow some customization of the Growl that is sent.

How do I Install this?
----------------------
If you just want the current packaged extension:

+ Download the Zip (look to the right)
+ Install the latest thundergrowl.xpi file from the build folder. You can ignore everything else.
+ If you already have the Thunderbird Growl extension installed - disable that (I'm not sure what will happen if these both try and run at the same time)


Regular Expression Filters
--------------------------

By default all incomming messages are set to growl. This modified extension builds off the original by assuming that as the default and allows you to set up filters to EXCLUDE items.
Filters are case sensitive regular expressions set against either the:

+  Folder Name
+  Sender Name/Email
+  Subject

If you are not familiar with regular expressions here are a few simple examples that may help. 

To EXCLUDE all messages that have a subject that includes the word "trigger" (remember it's case sensitive) enter the following into the subject filter
```trigger```

To EXCLUDE all messages that arrive in either the "exmaple1" folder AND the "example2" folder  enter the following into the folder filter
```example1|example2```



Junk, Sent, Trash, and Drafts folders are all automatically excluded. That means in general you do not need to worry about excluding spam.


Need More?
----------

Please feel free to contribute ideas and patches. Not being anything close to a XPCOM hacker what is possible to implement may be limited.