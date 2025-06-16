const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Quatrain Charting Client",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    const appPath = `file://${path.join(__dirname, 'build/index.html')}`;
    console.log('Loading app from:', appPath); // Debug log
    win.loadURL(appPath);

    // Define a custom menu template
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit(),
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    role: 'toggleDevTools', // Adds Developer Tools toggle
                },
            ],
        },
        {
            label: 'Quatrain',
            submenu: [
                {
                    label: 'Refresh Charts',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        console.log('Refresh Charts clicked');
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://github.com/xai-org/grok');
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});