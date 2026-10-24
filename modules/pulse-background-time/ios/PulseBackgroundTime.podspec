Pod::Spec.new do |s|
  s.name           = 'PulseBackgroundTime'
  s.version        = '1.0.0'
  s.summary        = 'Keeps Pulse running briefly in the background to finish a request'
  s.author         = 'Pulse'
  s.homepage       = 'https://github.com/sslugic/pulse'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.swift'
  s.swift_version  = '5.9'
end
