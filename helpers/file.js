const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Me = imports.misc.extensionUtils.getCurrentExtension();
Me.imports.helpers.polyfills;
const ByteArray = imports.byteArray;

let blocklist = [
    "/sys/class/hwmon/hwmon2/fan1_input",
    "/sys/class/hwmon/hwmon2/fan3_input",
    "/sys/class/hwmon/hwmon2/fan4_input",
    "/sys/class/hwmon/hwmon2/fan5_input",
    "/sys/class/hwmon/hwmon2/temp1_input",  // SYSTIN
    "/sys/class/hwmon/hwmon2/temp4_input",  // AUXTIN1
    "/sys/class/hwmon/hwmon2/temp5_input",  // AUXTIN2
    "/sys/class/hwmon/hwmon2/temp6_input",  // AUXTIN3
    "/sys/class/hwmon/hwmon2/temp8_input",  // PCH_CHIP_CPU_MAX_TEMP
    "/sys/class/hwmon/hwmon2/temp9_input",  // PCH_CHIP_TEMP
    "/sys/class/hwmon/hwmon2/temp10_input", // PCH_CPU_TEMP
];

function isInBlockList(path){
    return blocklist.includes(path);
}

function addBlockList(path){
    blocklist.push(path);
}

function getcontents(filename) {
    let handle = Gio.File.new_for_path(filename);
    let contents = handle.load_contents(null)[1];
    return ByteArray.toString(contents).trim();
}

function File(path) {
    if (path.indexOf('https://') == -1)
        this.file = Gio.File.new_for_path(path);
    else
        this.file = Gio.File.new_for_uri(path);
}

File.prototype.read = function(delimiter = '', strip_header = false) {
    return new Promise((resolve, reject) => {
        try {
            this.file.load_contents_async(null, function(file, res) {
                try {
                    // grab contents of file or website
                    let contents = file.load_contents_finish(res)[1];

                    // convert contents to string
                    contents = ByteArray.toString(contents).trim();

                    // split contents by delimiter if passed in
                    if (delimiter) contents = contents.split(delimiter);

                    // optionally strip header when converting to a list
                    if (strip_header) contents.shift();

                    // return results
                    resolve(contents);
                } catch (e) {
                    reject(e.message);
                }
            });
        } catch (e) {
            reject(e.message);
        }
    });
};

File.prototype.list = function() {
    return new Promise((resolve, reject) => {
        let max_items = 125, results = [];

        try {
            this.file.enumerate_children_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null, function(file, res) {
                try {
                    let enumerator = file.enumerate_children_finish(res);

                    let callback = function(enumerator, res) {
                        try {
                            let files = enumerator.next_files_finish(res);
                            for (let i = 0; i < files.length; i++) {
                                let fullPath = `${file.peek_path()}/${files[i].get_name()}`;
                                if (isInBlockList(fullPath)){
                                    //global.log(`file-list blocked: ${fullPath}`);
                                    continue;
                                }
                                results.push(files[i].get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_NAME));
                            }

                            if (files.length == 0) {
                                enumerator.close_async(GLib.PRIORITY_LOW, null, function(){});
                                resolve(results);
                            } else {
                                enumerator.next_files_async(max_items, GLib.PRIORITY_LOW, null, callback);
                            }
                        } catch (e) {
                            reject(e.message);
                        }
                    };

                    enumerator.next_files_async(max_items, GLib.PRIORITY_LOW, null, callback);
                } catch (e) {
                    reject(e.message);
                }
            });
        } catch (e) {
            reject(e.message);
        }
    });
};
