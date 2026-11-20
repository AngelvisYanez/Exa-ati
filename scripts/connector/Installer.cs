using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;

class Installer {
    static int Main(string[] args) {
        try {
            using (var payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("connector.zip")) {
                var hash = BitConverter.ToString(SHA256.Create().ComputeHash(payload)).Replace("-", "");
                if (args.Length == 1 && args[0] == "--verify") { Console.WriteLine(hash); return 0; }
                payload.Position = 0;
                var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EXA-ATI", "Conector", hash);
                Directory.CreateDirectory(root);
                using (var archive = new ZipArchive(payload)) {
                    foreach (var entry in archive.Entries) {
                        var target = Path.GetFullPath(Path.Combine(root, entry.FullName));
                        if (!target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException();
                        Directory.CreateDirectory(Path.GetDirectoryName(target));
                        entry.ExtractToFile(target, true);
                    }
                }
                var scripts = Path.Combine(root, @"scripts\connector\distribution");
                return Run(scripts, "Panel.ps1");
            }
        } catch(Exception e) { System.Windows.Forms.MessageBox.Show(e.Message, "Conector SRI"); return 1; }
    }
    static int Run(string folder, string script) {
        var psi = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"), "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(folder, script) + "\"");
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        using(var child = Process.Start(psi)) { child.WaitForExit(); return child.ExitCode; }
    }
}
