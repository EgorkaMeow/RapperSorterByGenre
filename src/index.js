const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');

const fs = require('fs');
const XLSX = require('xlsx');

const updater = require('./updater');
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, aboutWindow;
let mainData,
	mainDataSort = {},
	openedFile = false;

const createWindow = () => {
  // Create the browser window.
	mainWindow = new BrowserWindow({
		resizable: false,
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true
		}
	});

  // and load the index.html of the app.
	mainWindow.loadURL(`file://${__dirname}/mainWindow.html`);

	Menu.setApplicationMenu(Menu.buildFromTemplate([
	{
		label: 'Файл',
		submenu: [
			{
				label: 'Открыть',
				click: () => {
					mainData = null;
					mainDataSort = {};
					openedFile = true;
					dialog.showOpenDialog(mainWindow, {
						properties: ['openFile'],
						filters: [
							{ name: 'Файл Excel или текстовый', extensions: ['xlsx', 'txt'] },
						]
					}).then(result => {
						console.log(result);
						console.log(result.filePaths[0]);
						let workbook = XLSX.readFile(result.filePaths[0]);
						let sheet_name_list = workbook.SheetNames;
						mainData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
						for(let data of mainData){
							let errors = [];
							if(Object.keys(data)[0] != 'Name'){
								data['Name'] = data[Object.keys(data)[0]];
								errors.push(Object.keys(data)[0]);
							}
							if(Object.keys(data)[1] != 'Emails'){
								data['Emails'] = data[Object.keys(data)[1]];
								errors.push(Object.keys(data)[1]);
							}
							if(Object.keys(data)[2] != 'Genre'){
								data['Genre'] = data[Object.keys(data)[2]];
								errors.push(Object.keys(data)[2]);
							}
							for(let error of errors){
								delete data[error];
							}
							data.Emails = data.Emails.split(/\s*[/]\s*/g);
							data.Genre = data.Genre.split(/\s*[,]\s*/g);
							for(let genre of data.Genre){
								if(!mainDataSort.hasOwnProperty(genre)){
									mainDataSort[genre] = [];
								}
								mainDataSort[genre].push(data);
							}
						}
						console.log(mainData);

						console.log(mainDataSort);

						getData();
						saveDataToFile();
					}).catch(err => {
						console.log(err)
					})
				}
			},
			{
				type: 'separator'
			},
			{
				label: 'О программе',
				click: () => {
					aboutWindow = new BrowserWindow({
						resizable: false,
						width: 400,
						height: 300,
						autoHideMenuBar: true,
						webPreferences: {
							nodeIntegration: true
						}
					});

					aboutWindow.loadURL(`file://${__dirname}/aboutWindow.html`);

					aboutWindow.on('closed', () => {
						aboutWindow = null;
					});
				}
			}
		]
	}
	]));
  // Open the DevTools.
 // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
	mainWindow.on('closed', () => {
	// Dereference the window object, usually you would store windows
	// in an array if your app supports multi windows, this is the time
	// when you should delete the corresponding element.
		mainWindow = null;
	});

	mainWindow.webContents.once("did-frame-finish-load", function (event) {
		console.log('Ready to look for update');
		updater.init()
	})
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

ipcMain.on('loadData', () => {
	readDataFromFile();

});

ipcMain.on('link', (e, link) => {
	shell.openExternal(link);

});

function getData() {
	if(void 0 == mainData || null == mainData){
		mainWindow.webContents.send('data', {
			response: false,
			openedFile
		});
	}
	else {
		mainWindow.webContents.send('data', {
			response: true,
			openedFile,
			result: { mainData, mainDataSort }
		});
	}
}

function readDataFromFile(){
	if (!fs.existsSync('./data')){
		fs.mkdirSync('./data');
		fs.writeFile('data/data.json', JSON.stringify({}), (err) => {
			if (err){
				throw err;
			}
		});
	}
	fs.readFile('data/data.json', (err, data) => {
		if(err){
			if('ENOENT' !== err.code){
				throw err;
			}
		}
		if(0 !== Object.keys(JSON.parse(data)).length){
			mainData = JSON.parse(data).mainData;
			mainDataSort = JSON.parse(data).mainDataSort;
			mainWindow.webContents.send('allData', {
				response: true,
				openedFile,
				result: { mainData, mainDataSort }
			});
		}
		else {
			mainData = null;
			mainDataSort = null;
			mainWindow.webContents.send('allData', {
				response: false
			});
		}
	});
}

function saveDataToFile(){
	fs.writeFile('data/data.json', JSON.stringify({
		mainData,
		mainDataSort
	}), (err) => {
		if (err){
			throw err;
		}
	});
}


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
