function doGet(e) {
  Logger.log("doggies and kitties");
  Logger.log(e);
  return HtmlService.createHtmlOutputFromFile("page");
}

// UPDATE SHEET

function updateGoals(sheetUrl, data) {
  try {
    var goalsSheet = SpreadsheetApp.openByUrl(sheetUrl).getSheetByName("Goals");
    //  var range = goalsSheet.getRange(2, 1, goalsSheet.getLastRow() - 1, goalsSheet.getLastColumn() - 1);
    var range = goalsSheet.getRange(8, 2, 1, goalsSheet.getLastColumn() - 1);
    Logger.log(range.getValues());
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      row[1] = new Date(row[1]); // start date
      row[2] = new Date(row[2]); // end date
      row[3] = Number(row[3]); // goal number
    }
    Logger.log(data);
    range.setValues([data[0]]);
  } catch (e) {
    Logger.log(e);
  }
}

function resetMemberStatus(sheet) {
  var data = sheet.getDataRange().getValues();
  var supporterTypeColumnIndex = getColumnIndexWithName(
    "Supporter Type",
    sheet
  );
  var baseColumnIndex = getColumnIndexWithName("Last Base Action", sheet);
  var activeSupportColumnIndex = getColumnIndexWithName(
    "Last Active Support Action",
    sheet
  );
  var memberColumnIndex = getColumnIndexWithName("Last Member Action", sheet);

  // member if taken appropriate action in last 6 months
  for (i = 1; i < data.length; i++) {
    var memberType = "";
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (
      data[i][memberColumnIndex - 1] !== "" &&
      new Date(data[i][memberColumnIndex - 1]) > sixMonthsAgo
    ) {
      memberType = "Member";
    } else if (
      data[i][activeSupportColumnIndex - 1] !== "" &&
      new Date(data[i][activeSupportColumnIndex - 1]) > sixMonthsAgo
    ) {
      memberType = "Active Support";
    } else if (
      data[i][baseColumnIndex - 1] !== "" &&
      new Date(data[i][baseColumnIndex - 1]) > sixMonthsAgo
    ) {
      memberType = "Base";
    }
    sheet.getRange(i + 1, supporterTypeColumnIndex).setValue(memberType);
  }
}

function markMeetingAttendence(sheetUrl, attendees, attendenceType) {
  try {
    var sheet = SpreadsheetApp.openByUrl(sheetUrl).getSheets()[0];
    var attendenceRowMap = {
      support: getColumnIndexWithName("Last Base Action", sheet),
      activeSupport: getColumnIndexWithName(
        "Last Active Support Action",
        sheet
      ),
      member: getColumnIndexWithName("Last Member Action", sheet)
    };
    var data = sheet.getDataRange();
    for (i = 1; i < sheet.getLastRow(); i++) {
      for (n = 0; n < attendees.length; n++) {
        var name = attendees[n];
        Logger.log("looping through attendee named" + name);
        if (name === data.getValues()[i][1]) {
          Logger.log("found attendee");
          var range = sheet.getRange(i + 1, attendenceRowMap[attendenceType]);
          Logger.log(range);
          range.setValue(new Date().toLocaleDateString());
        }
      }
    }
    resetMemberStatus(sheet);
  } catch (e) {
    Logger.log("markMeetingAttendence Error");
    Logger.log(e);
  }
}

// GET DATA  //

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function getSheetData(sheetUrl) {
  try {
    var sheet = SpreadsheetApp.openByUrl(sheetUrl).getSheets()[0];
    var data = sheet.getDataRange().getValues();
    return JSON.stringify(data);
  } catch (e) {
    Logger.log("getNamesInSheetError");
    Logger.log(e);
  }
}

function getGoals(sheetUrl) {
  try {
    var sheet = SpreadsheetApp.openByUrl(sheetUrl).getSheetByName("Goals");
    var data = sheet.getDataRange().getValues();
    return JSON.stringify(data);
  } catch (e) {
    Logger.log("getGoals Error");
    Logger.log(e);
  }
}

// CREATE DATA //

function createGoalsSheet(ss) {
  var goalsSheet = ss.insertSheet("Goals");
  var range = goalsSheet.getRange(1, 1, 4, 7);
  var today = new Date();
  var sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  range.setValues([
    [
      "Goal Id",
      "Goal Name",
      "Start Date",
      "End Date",
      "Goal Number",
      "Column",
      "Value"
    ],
    ["0", "Members", today, sixMonthsFromNow, "5", "Supporter Type", "Member"],
    [
      "1",
      "Active Supporters",
      today,
      sixMonthsFromNow,
      "10",
      "Supporter Type",
      "Active Support,Member"
    ],
    [
      "2",
      "Base",
      today,
      sixMonthsFromNow,
      "20",
      "Supporter Type",
      "Base,Active Support,Member"
    ]
  ]);
  goalsSheet.setFrozenRows(1);
}

function createFormAndSheet(campaignName, supportDescription) {
  Logger.log("Creating new sheet");
  var ss = SpreadsheetApp.create(campaignName + " Sheets");

  var form = FormApp.create(campaignName + " Sign Up");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  form.setDescription(supportDescription);
  form
    .addTextItem()
    .setTitle("Name")
    .setRequired(true);
  form
    .addTextItem()
    .setTitle("Email")
    .setRequired(true);
  form
    .addTextItem()
    .setTitle("Phone")
    .setRequired(true);

  var sheet = ss.getSheetByName("Form Responses 1");
  sheet.setName("Supporters");
  sheet
    .getRange(1, 2, 1, 4)
    .setValues([
      [
        "Supporter Type",
        "Last Base Action",
        "Last Active Support Action",
        "Last Member Action"
      ]
    ]);
  var url = ss.getUrl();
  Logger.log("Made sheet and set new value");

  ss.setActiveSheet(ss.getSheetByName("Sheet1"));
  ss.deleteActiveSheet();
  Logger.log("Deleted old sheet");
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  Logger.log(url);
  createGoalsSheet(ss);
  //  ss.setActiveSheet(sheet);
  return {
    sheetUrl: url,
    sheetId: ss.getId(),
    formUrl: form.getPublishedUrl()
  };
}

// TRIGGERS //

function onFormSubmit(e) {
  try {
    var user = {
      name: e.namedValues["Name"][0],
      email: e.namedValues["Email"][0],
      phone: e.namedValues["Phone"][0]
    };
    // Grab the session data again so that we can match it to the user's choices.
    var sheet = SpreadsheetApp.getActive().getActiveSheet();
    var range = sheet.getRange(
      sheet.getLastRow(),
      getColumnIndexWithName("Last Base Action", sheet)
    );
    var values = range.setValue(new Date().toLocaleDateString());
    Logger.log("Updated last action for " + user.name);
    resetMemberStatus(sheet);
  } catch (e) {
    Logger.log("error caught: " + e);
    Logger.log("error caught: " + e.message);
  }
}

// HELPERS

function getColumnIndexWithName(name, sheet) {
  var headerValues = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  for (i = 0; i < headerValues.length; i++) {
    if (headerValues[i] === name) {
      Logger.log("column index " + (i + 1));
      return i + 1;
    }
  }
}

function cleanUp() {
  var allTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < allTriggers.length; i++) {
    ScriptApp.deleteTrigger(allTriggers[i]);
  }
}
