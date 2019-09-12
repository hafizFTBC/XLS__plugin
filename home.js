/// <reference path="app.js" />

(function () {
    "use strict";
    // The initialize function must be run each time a new page is loaded
  


    Office.onReady()
    .then(function (){
        $(document).ready(function () {
           

            // If not using Excel 2016, return
            if (!Office.context.requirements.isSetSupported('ExcelApi', '1.1')) {
                app.showNotification("Need Office 2016 or greater", "Sorry, this add-in only works with newer versions of Excel.");
                return;
            }

            // Attach a click event handler for the button
            $('#get-repo-info').click(getRepoInfo);
            $('#update-info').click(syncToVAL);
            $('#open-dialog').click(dialogVerify);
            $('#login-button').click(login);
            document.getElementById("repotype_selection").addEventListener("change", repoTypeSelectionChange);
            document.getElementById("project_selection").addEventListener("change", projectSelectionChange);
            document.getElementById("phase_selection").addEventListener("change", phaseSelectionChange);
            document.getElementById("repo_selection").addEventListener("change", repoSelectionChange);
            $('#backButton').click(previousPage);

            checkLoginStatus()
            
            // Put the default search keyword and language into the active worksheet
            // Run a batch operation against the Excel object model
            Excel.run(function (ctx) {
                //Run the queued-up commands, and return a promise to indicate task completion
                return ctx.sync()
                    .then(function () {
                        console.log("Event handler successfully registered for onChanged event in the worksheet.");
                    });

            })
                .catch(function (error) {
                    // Always be sure to catch any accumulated errors that bubble up from the Excel.run execution
                    app.showNotification("Error: " + error);
                    console.log("Error: " + error);
                    if (error instanceof OfficeExtension.Error) {
                        console.log("Debug info: " + JSON.stringify(error.debugInfo));
                    }
                });
        });
    });

    // Click event handler for the button
    // Get repo information from GitHub using their public Search API
    function getRepoInfo() {
        // Run a batch operation against the Excel object model
        Excel.run(function (ctx) {
            $('#notification-message').hide();
            let requestObj = {};
            let fullData = true;
            let columns = [];
            var sheet = ctx.workbook.worksheets.getActiveWorksheet();
            let table = selectionModel.repo
            sheet.tables.load("name");
            return ctx.sync().then(function () {

                for (var i = 0; i < sheet.tables.items.length; i++) {
                    if (sheet.tables.items[i].name == table) {
                        fullData = false;
                        break;
                    }
                }
                console.log(fullData)
                if (fullData) {
                    console.log(token)
                    let options = {
                        api_token: token,
                        table_name: table,
                        options: {
                            display: true
                        }
                    }

                    requestObj = { url: "/pullFullData", data: options }
                } else {

                    _.map(mapSettings, item => {
                        if (item.valField != "None") {
                            columns.push(item.valField)
                        }
                    })
                    columnsMapped = columns

                    //add checker to ensure no blank column
                    let options = {
                        api_token: token,
                        table_name: table,
                        options: {
                            display: true,
                        }
                    }

                    requestObj = { url: "/pullPartialData", data: options }
                }

                $.ajax(requestObj)
                    .done(function (data) {

                        let records = JSON.parse(data);
                        console.log(records)
                        currentTable = records.table_name;
                        localStorage.setItem("tableDetails", JSON.stringify(records));
                        tableDetails = records;
                        if (fullData) {
                            convertToExcelTable(records);

                        } else {
                            console.log("huehuehu here MATEY")

                            let temp = currentTable.split("_")
                            let repo_id = temp[2]
                            let table_pk = ''
                            getRepoTypeDetails()
                                .then(res => {
                                    let currentRepo = _.find(res, { "repo_id": parseInt(repo_id) })
                                    table_pk = currentRepo.repo_primary_key

                                    updateDisplayTable(table_pk, records, columnsMapped);
                                })

                        }

                    })
                    .fail(function (jqXHR, textStatus, errorThrown) {

                        console.log(textStatus)
                        console.log(errorThrown)
                        // app.showNotification("Error calling VAL API", "Error message: " + response.message + ".    "
                        //     + "For more info, check out: " + response.documentation_url);
                        // console.log(JSON.stringify(jqXHR));
                    });
            })
                .then(ctx.sync)
                .catch(function (error) {
                    // Always be sure to catch any accumulated errors that bubble up from the Excel.run execution
                    app.showNotification("Error: " + error);
                    console.log("Error: " + error);
                    if (error instanceof OfficeExtension.Error) {
                        console.log("Debug info: " + JSON.stringify(error.debugInfo));
                    }
                });
        })
    }

    function convertToExcelTable(rawContent) {
        Excel.run(function (ctx) {
            var sheet = ctx.workbook.worksheets.getActiveWorksheet();
            let headers = [];
            _.map(rawContent.fields, (field, index) => {
                if (field.display && field.display != "Updated Date") {
                    headers.push(field.display)
                }
            })

            let newRange = numToSSColumn(headers.length)
            var table = sheet.tables.add(`A1:${newRange}1`, true);
            console.log(rawContent)
            table.name = rawContent.table_name;
            let arrayHeader = [];
            arrayHeader.push(headers)
            table.getHeaderRowRange().values = arrayHeader;

            var tableRows = table.rows;
            var items = rawContent.records;
            _.map(items, (val, index) => {
                let temp = []
                _.forEach(rawContent.fields, (field) => {
                    if (field.column_name != "updated_date") {
                        temp.push(val[field.column_name])
                    }
                })
                tableRows.add(null, [temp])
            })

            console.log("CHECK THIS")
            let mapping = [];
            _.map(rawContent.fields, field => {
                if (field.column_name != "updated_date") {
                    mapping.push({ header: field.display, valField: field.column_name })
                }
            })


            localStorage.setItem("mapSettings", JSON.stringify(mapping));
            mapSettings = mapping;
            app.showNotification("Successfully imported data from VAL", 'success')
            return ctx.sync();
        })
            .catch(error => {
                app.showNotification("Error: " + error);
                console.log("Error: " + error);
                if (error instanceof OfficeExtension.Error) {
                    console.log("Debug info: " + JSON.stringify(error.debugInfo));
                }
            })
    }

    function syncToVAL() {
        Excel.run(function (ctx) {
            $('#notification-message').hide();
            currentTable = selectionModel.repo;
            return ctx.sync()
                .then(() => {
                    let temp = currentTable.split("_")
                    let repo_id = temp[2]
                    let table_pk = ''

                    return getRepoTypeDetails()
                        .then(allRepo => {
                            let currentRepo = _.find(allRepo, { "repo_id": parseInt(repo_id) })
                            table_pk = currentRepo.repo_primary_key
                            console.log(table_pk)
                            return getTableDetails(currentTable)
                        })
                        .then(details => {
                            let selectedColumnObj = []
                            let selectedCol = []
                            console.log(mapSettings)
                            _.map(mapSettings, item => {
                                if (item.valField && item.valField != "None") {
                                    if (item.valField != table_pk) {
                                        selectedCol.push(item.valField)
                                    }
                                }
                            })
                            _.map(details.fields, field => {
                                if (selectedCol.indexOf(field.column_name) >= 0) {
                                    let obj = {
                                        selectedField: field.column_name,
                                        selectedFieldDatatype: field.raw_data_type
                                    }
                                    selectedColumnObj.push(obj)
                                }
                            })

                            console.log(selectedColumnObj)
                            prepDataForUpdate(table_pk, details, selectedColumnObj)
                        })
                })

        })
            .catch(err => {
                console.log(err)
            })
    }

    function prepDataForUpdate(pk, tableDetails, selectedColumnObj) {
        Excel.run(function (ctx) {
            let selectedColumn = selectedColumnObj//user defined 
            var sheet = ctx.workbook.worksheets.getActiveWorksheet();
            var tableToUpdate = sheet.tables.getItem(currentTable);
            var headerRange = tableToUpdate.getHeaderRowRange().load("values");
            var bodyRange = tableToUpdate.getDataBodyRange().load("values");


            return ctx.sync()
                .then(() => {
                    let headers = _.flattenDeep(headerRange.values);
                    let xlsData = [];
                    _.map(bodyRange.values, (row, index) => {
                        let rowObj = {};
                        _.map(headers, (header, colNum) => {
                            let temp = _.find(mapSettings, { 'header': header })
                            if (temp) {
                                rowObj[temp.valField] = row[colNum];
                            }
                        })
                        xlsData.push(rowObj);
                    })
                    console.log(xlsData)

                    let columnsToUpdate = [];


                    let indexer = 1;
                    _.map(tableDetails.fields, fields => {
                        if (fields.column_name == pk) {
                            fields.field_name = "id";
                            columnsToUpdate.push(fields);
                            selectedColumn.unshift({
                                selectedField: fields.column_name,
                                selectedFieldDatatype: fields.raw_data_type,
                                pkField: true
                            })

                        } else {
                            if (_.find(selectedColumn, { 'selectedField': fields.column_name })) {
                                fields.field_name = `value${indexer}`;
                                columnsToUpdate.push(fields);
                                indexer++;

                            }
                        }
                    })

                    let content = [];

                    _.map(xlsData, rec => {
                        let obj = {}
                        _.map(columnsToUpdate, field => {
                            obj[field.field_name] = rec[field.column_name]
                        })
                        content.push(obj)
                    })

                    console.log(content)
                    let all_params = {
                        token: token,
                        content: content,
                        selectedColumn: selectedColumn,
                        table_name: currentTable,
                        comment: 'Update from XLS Plugin'

                    }
                    $.ajax({ url: "updateRecord", data: all_params })
                        .done(res => {
                            app.showNotification("Successfully uploaded data into VAL", 'success')
                        })
                        .fail(function (jqXHR, textStatus, errorThrown) {
                            // var response = $.parseJSON(jqXHR.responseText);
                            // app.showNotification("Error calling VAL API", "Error message: " + response.message + ".    "
                            // + "For more info, check out: " + response.documentation_url);
                            app.showNotification("Error.There was an error. Please try again")

                        })

                })
        })
    }

    function updateDisplayTable(pk_db, content, columns) {
        Excel.run(function (ctx) {
            var sheet = ctx.workbook.worksheets.getActiveWorksheet();
            var tableToUpdate = sheet.tables.getItem(currentTable);
            let displayColumn = [];
            _.map(columns, col => {
                let temp = _.find(content.fields, { 'column_name': col })
                if (temp) {
                    let foundDetails = _.find(mapSettings, { 'valField': col })
                    displayColumn.push(foundDetails.header)
                }
            })
            sheet.tables.load("name");
            var headerRange = tableToUpdate.getHeaderRowRange().load("values");
            var bodyRange = tableToUpdate.getDataBodyRange().load("values");

            let pk = (_.find(content.fields, { 'column_name': pk_db })).display
            return ctx.sync()
                .then(() => {
                    let headers = _.flatten(headerRange.values);
                    let toUpdateValues = []
                    let bodyContent = bodyRange.values;
                    _.map(content.records, (val, key) => {
                        let obj = {};
                        _.forEach(columns, (col, index) => {
                            if (val[col]) {
                                obj[col] = val[col]
                            }
                        })
                        toUpdateValues.push(obj)

                    })
                    let indexerObj = {}

                    _.map(headers, (val, key) => {
                        if (displayColumn.indexOf(val) >= 0) {
                            indexerObj[val] = key
                        }
                    })

                    let newData = [];

                    let pk_index = 0;
                    _.map(headers, (column, col_index) => {
                        if (column == pk) {
                            pk_index = col_index;
                        }
                    })
                    let objDataIndex = {};
                    _.map(bodyContent, (row) => {
                        objDataIndex[row[pk_index]] = row;
                    })

                    console.log(objDataIndex)
                    console.log(toUpdateValues)
                    _.map(toUpdateValues, (row) => {
                        let newRow = [];
                        _.map(headers, (column) => {
                            newRow.push(row[column])
                        })
                        newData.push(row)

                        //update bodyContent
                        _.map(displayColumn, (col) => {
                            if (col == pk) {
                            } else {
                                let indexToupdate = indexerObj[col]
                                //get the mapping 
                                let mappedField = _.find(mapSettings, { "header": col })
                                objDataIndex[row[pk_db]][indexToupdate] = row[mappedField.valField];
                            }
                        })
                    })
                    for (var i = 0; i < sheet.tables.items.length; i++) {
                        if (sheet.tables.items[i].name == selectionModel.repo) {
                            sheet.tables.items[i].delete();
                            break;
                        }
                    }

                    let newRange = numToSSColumn(headers.length)
                    var table = sheet.tables.add(`A1:${newRange}1`, true);

                    table.name = content.table_name;
                    let arrayHeader = [];
                    arrayHeader.push(headers)
                    table.getHeaderRowRange().values = arrayHeader;



                    let tempTable = _.filter(objDataIndex, item => {
                        return item;
                    })

                    table.rows.add(null, tempTable);
                    if (Office.context.requirements.isSetSupported("ExcelApi", 1.2)) {
                        sheet.getUsedRange().format.autofitColumns();
                        sheet.getUsedRange().format.autofitRows();
                    }
                    sheet.activate();
                    app.showNotification("Successfully imported data from VAL", 'success')
                    return ctx.sync();
                })
        })
            .catch(error => {
                app.showNotification("Error: " + error);
                console.log("Error: " + error);
                if (error instanceof OfficeExtension.Error) {
                    console.log("Debug info: " + JSON.stringify(error.debugInfo));
                }
            })
    }

    function dialogVerify() {
        $('#notification-message').hide();
        if (currentTableInfo && currentTableInfo.fields && currentTableInfo.fields.length) {
            openDialog();
        }
        else {
            getTableDetails(selectionModel.repo)
                .then(res => {
                    currentTableInfo = res;
                    openDialog();
                })
        }

        console.log(currentTableInfo)

    }

    function openDialog() {
        Excel.run(function (ctx) {
            var sheet = ctx.workbook.worksheets.getActiveWorksheet();
            var tableToUpdate = sheet.tables.getItem(selectionModel.repo);
            var headerRange = tableToUpdate.getHeaderRowRange().load("values");
            return ctx.sync()
                .then(() => {
                    let excelHeaders = _.flatten(headerRange.values)
                    localStorage.setItem("headerSet", JSON.stringify(excelHeaders));
                    Office.context.ui.displayDialogAsync(
                        'https://localhost:443/popup.html?',
                        { height: 45, width: 55 },
                        // TODO2: Add callback parameter.
                        function (result) {
                            dialog = result.value;
                            dialog.addEventHandler(Microsoft.Office.WebExtension.EventType.DialogMessageReceived, processMessage);
                        }
                    );
                })
        })
    }

    function processMessage(arg) {
        let mappingArr = JSON.parse(arg.message)
        dialog.close();
        if (mappingArr && mappingArr.length > 0) {
            let verifier = verifyMapping(mappingArr)
            if (verifier) {
                //save into ui_settings_master
                saveSettings(mappingArr)
            } else {
                //your Pk field is not mapped or there are duplicates in your mapping. 
                app.showNotification("Error! Pk field is not mapped or there are duplicates in your mapping")
            }
        }
    }


    function repoTypeSelectionChange() {
        var optionSelected = $(`#repotype_selection option:selected`).val();
        console.log(optionSelected)
        handleSelectionChanges("repo_type", optionSelected);
    }

    function projectSelectionChange() {
        var optionSelected = $(`#project_selection option:selected`).val();
        console.log(optionSelected)
        handleSelectionChanges("project", optionSelected);
    }
    function phaseSelectionChange() {
        var optionSelected = $(`#phase_selection option:selected`).val();
        console.log(optionSelected)
        handleSelectionChanges("phase", optionSelected);
    }
    function repoSelectionChange() {
        var optionSelected = $(`#repo_selection option:selected`).val();
        console.log(optionSelected)
        handleSelectionChanges("repo", optionSelected);
    }

    function handleSelectionChanges(type, valueToStore) {
        console.log("handling selection")
        console.log(type, valueToStore)
        switch (type) {
            case 'repo_type':
                selectionModel.repoType = valueToStore;
                getTableDetails(valueToStore);
                break;
            case 'project':
                selectionModel.project = valueToStore;
                // trigger function to retrieve phases
                getUserPhases()
                break;
            case 'phase':
                //trigger function to retrieve tables
                selectionModel.phase = valueToStore
                break;
            case 'repo':
                // goes to selection page. 
                //handle saving of settings
                selectionModel.repo = valueToStore

                checkSelections()

                break;

        }
    }

    function checkSelections() {
        try {
            if (!selectionModel.repoType || selectionModel.repoType == '' || selectionModel.repoType == "0") {
            }
            else if (!selectionModel.project || selectionModel.project == '' || selectionModel.project == "0") {
            }
            else if (!selectionModel.phase || selectionModel.phase == '' || selectionModel.phase == "0") {
            }
            else if (!selectionModel.repo || selectionModel.repo == '' || selectionModel.repo == "0") {
            }
            else {
                // next page
                getSettings()
                $('#loginContainer').hide();
                $('#selectionContainer').hide();
                $('#actionContainer').show();
            }
        }
        catch (err) {
            console.log(err)
        }

    }


    function login() {
        let user = $('#userName').val();
        let pass = $('#userPass').val();
        let requestObj = { url: "/login", data: { email: user, password: pass } }
        $.ajax(requestObj)
            .done(res => {
                if (res && res.api_token && res.api_token != '') {
                    token = res.api_token;
                    localStorage.setItem("user_token", token);
                    loggedIn = true;
                    checkLoginStatus();
                }
            })
            .fail((jqXHR, textStatus, errorThrown) => {

            })

    }

    //helper Functions
    function getTableDetails(repo_id) {
        return new OfficeExtension.Promise((resolve, reject) => {
            // return Excel.run(function (context) {
            console.log(2)
            // let temp = table_name.split("_");
            // let repo_id = temp[2];
            $.ajax({ url: "/getRepoDetails", data: { api_token: token, repo_id: repo_id } })
                .done(res => {
                    console.log(res)
                    let toReturn = _.find(res.records, { "tablename": selectionModel.repo });
                    currentTableInfo = res.records;
                    console.log(currentTableInfo)
                    valObj.repoTableSelection = currentTableInfo;
                    setOptionsForDropDown('repoDropdown')
                    resolve(toReturn)
                    // resolve(toReturn)

                })
                .fail(function (jqXHR, textStatus, errorThrown) {

                });

        })
    }

    function getRepoTypeDetails() {
        return new OfficeExtension.Promise((resolve, reject) => {
            $.ajax({ url: "/getRepoTypes", data: { api_token: token } })
                .done(repoTypes => {
                    valObj.allRepo = repoTypes;
                    setOptionsForDropDown('repoTypeDropdown');

                    resolve(repoTypes);
                })
                .fail(function (jqXHR, textStatus, errorThrown) {

                });

        })
    };

    function getUserProjects() {
        return new OfficeExtension.Promise((resolve, reject) => {
            $.ajax({ url: "/getUserProjects", data: { api_token: token } })
                .done(projects => {
                    valObj.projects = projects;
                    setOptionsForDropDown('projectDropdown');
                    resolve(projects);
                })
                .fail(function (jqXHR, textStatus, errorThrown) {

                });

        })
    };

    function getUserPhases() {
        //add check so dont have to make rest call all the time 
        return new OfficeExtension.Promise((resolve, reject) => {
            $.ajax({ url: "/getUserPhases", data: { api_token: token } })
                .done(phases => {
                    valObj.phases = phases;
                    console.log(phases)

                    setOptionsForDropDown('phaseDropdown');
                    resolve(phases);
                })
                .fail(function (jqXHR, textStatus, errorThrown) {

                });

        })
    };

    function setOptionsForDropDown(type) {
        try {
            let theDropDown = '';
            switch (type) {
                case 'repoTypeDropdown':
                    console.log(1)
                    theDropDown = document.getElementById(type);
                    theDropDown.querySelector('select').innerHTML = `<option value="0">Select a Repository Type </option>`
                    _.map(valObj.allRepo, repo => {
                        theDropDown.querySelector('select').innerHTML += `<option value="${repo.repo_id}">${repo.repo_name}</option>`
                    })


                    break;
                case 'projectDropdown':
                    console.log(2)
                    theDropDown = document.getElementById(type);
                    theDropDown.querySelector('select').innerHTML = `<option value="0">Select a Project </option>`
                    _.map(valObj.projects, project => {
                        theDropDown.querySelector('select').innerHTML += `<option value="${project.project_id}">${project.project_name}</option>`
                    })
                    break;
                case 'phaseDropdown':
                    theDropDown = document.getElementById(type);
                    theDropDown.querySelector('select').innerHTML = `<option value="0">Select a Phase </option>`
                    _.map(valObj.phases, phase => {
                        theDropDown.querySelector('select').innerHTML += `<option value="${phase.phase_id}">${phase.phase_name}</option>`
                    })
                    break;
                case 'repoDropdown':
                    theDropDown = document.getElementById(type);
                    theDropDown.querySelector('select').innerHTML = `<option value="0">Select a Repository </option>`
                    _.map(valObj.repoTableSelection, repo => {
                        theDropDown.querySelector('select').innerHTML += `<option value="${repo.tablename}">${repo.name}</option>`
                    })

                    break;

            }

            $(theDropDown).find(".ms-Dropdown-title").remove();
            $(theDropDown).find(".ms-Dropdown-items").remove();
            // let title = theDropDown.querySelector(".ms-Dropdown-title")
            // if(title)
            handleReinitialization(type);
            // var DropdownHTMLElements = theDropDown;
            // var Dropdown = new fabric['Dropdown'](DropdownHTMLElements); 
        }
        catch (err) {
            console.log(err)
        }
    }

    function handleReinitialization(type) {
        //handle disable classes 
        //reinitialize all dropdown
        //add logic to disable and renable selections
        var DropdownHTMLElements2 = document.querySelectorAll('.ms-Dropdown');
        for (var i = 0; i < DropdownHTMLElements2.length; i++) {
            if (type == DropdownHTMLElements2[i].id) {
                if (DropdownHTMLElements2[i].classList.contains('is-disabled')) {
                    DropdownHTMLElements2[i].classList.remove('is-disabled')
                }
                let Dropdown = new fabric['Dropdown'](DropdownHTMLElements2[i]);
            }
        }

    };



    function verifyMapping(mappingArr) {
        let pk = "testing_id";
        let pkMapped = false;
        let duplicates = false;
        let checkForDuplicate = [];
        console.log(mappingArr)
        //isolate the stuff users selsected
        _.map(mappingArr, item => {
            checkForDuplicate.push(item.valField)
        })

        let tempArr = []
        let duplicateItem = []
        _.map(checkForDuplicate, item => {
            console.log(item)
            if (item == pk) {
                pkMapped = true; // Ensure that pk is mapped
            }
            if (item == "None") {
                tempArr.push("None")
            } else {
                if (tempArr.indexOf(item) >= 0) {
                    duplicateItem.push(item)
                }
                else {
                    tempArr.push(item)
                }
            }
        })
        if (duplicateItem && duplicateItem.length > 0) {
            duplicates = true
        }



        if (pkMapped && !duplicates) {
            //all Swee, proceed to save the mapping 
            console.log("ALL GUCCI")
            return true;
        } else {
            //no go got error
            console.log("NO BUENO")
            return false;
        }

    };
    function getSettings() {
        Excel.run(ctx => {
            let requestObj = {}
            let workbook = ctx.workbook.load('name');
            let currentsheet = ctx.workbook.worksheets.getActiveWorksheet().load('name');
            return ctx.sync()
                .then(() => {

                    let options = {
                        api_token: token,
                        type: 'excel_plugin_mapping',
                        sub_type: currentTableInfo.tablename,
                        name: currentTableInfo.name,
                        includeSettings: true
                    }

                    requestObj = { url: "/retrieveMapping", data: options }
                    $.ajax(requestObj)
                        .done(res => {
                            let workbookDetails = `${workbook.name}_${currentsheet.name}`
                            if (res && res.length > 0 && res[0].settings) {
                                if (workbookDetails == res[0].name) {
                                    localStorage.setItem("mapSettings", JSON.stringify(res[0].settings));
                                    mapSettings = res[0].settings;
                                    console.log(mapSettings)
                                }
                            } else {
                                localStorage.removeItem(mapSettings)
                            }
                        })
                        .fail((jqXHR, textStatus, errorThrown) => {

                        })

                })
        })
    };

    function saveSettings(itemToSave) {
        Excel.run(ctx => {
            let requestObj = {}
            let workbook = ctx.workbook.load('name');
            let currentsheet = ctx.workbook.worksheets.getActiveWorksheet().load('name');
            mapSettings = itemToSave;
            return ctx.sync()
                .then(() => {
                    let options = {
                        api_token: token,
                        type: 'excel_plugin_mapping',
                        sub_type: currentTableInfo.tablename,
                        name: `${workbook.name}_${currentsheet.name}`,
                        settings: itemToSave
                    }
                    localStorage.setItem("mapSettings", JSON.stringify(itemToSave));
                    requestObj = { url: "/saveMapping", data: options }
                    $.ajax(requestObj)
                        .done(res => {
                            console.log(res)
                            console.log("HUEHUEHUE")
                        })
                        .fail((jqXHR, textStatus, errorThrown) => {

                        })

                })
        })


    };

    function checkLoginStatus() {
        //check from storage first 
        token = localStorage.getItem("user_token", token);
        
        if (token) {
            $('#loginContainer').hide();
            $('#selectionContainer').show();
            $('#actionContainer').hide();

            getRepoTypeDetails();
            getUserProjects();
        }
        else {
            $('#loginContainer').show();
            $('#selectionContainer').hide();
            $('#actionContainer').hide();
        }
    };

    function previousPage() {
        $('#notification-message').hide();
        $('#loginContainer').hide();
        $('#selectionContainer').show();
        $('#actionContainer').hide();
    }

    function numToSSColumn(num) {
        var s = '', t;

        while (num > 0) {
            t = (num - 1) % 26;
            s = String.fromCharCode(65 + t) + s;
            num = (num - t) / 26 | 0;
        }
        return s || undefined;
    };

    function columnToNum(val) {
        var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', i, j, result = 0;

        for (i = 0, j = val.length - 1; i < val.length; i += 1, j -= 1) {
            result += Math.pow(base.length, j) * (base.indexOf(val[i]) + 1);
        }

        return result;
    };

    function splitSingleAdd(address) {
        let row = '';
        let col = '';
        for (let i = 0; i < address.length; i++) {
            console.log(i)
            let test = parseInt(address[i])
            if (Number.isInteger(test)) {
                row += address[i]
            } else {
                col += address[i]
            }
        }

        return { row: row, col: col }

    };

    // end of helper functions

})();