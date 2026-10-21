import ExpoModulesCore
import UIKit

// Switches between the alternate app icons that plugins/with-alternate-icons.js adds to the asset
// catalog. iOS shows its own "You have changed the icon" alert; that can't be turned off.
public class PulseAppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PulseAppIcon")

    // The alternate icon in use (asset catalog name), or nil for the main one. Nil too when the
    // device can't change icons, so callers treat it as "main icon".
    AsyncFunction("current") { () async -> String? in
      await MainActor.run { UIApplication.shared.alternateIconName }
    }

    AsyncFunction("supported") { () async -> Bool in
      await MainActor.run { UIApplication.shared.supportsAlternateIcons }
    }

    // nil goes back to the main icon.
    AsyncFunction("set") { (name: String?) async throws in
      try await UIApplication.shared.setAlternateIconName(name)
    }
  }
}
