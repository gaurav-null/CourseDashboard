import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
imports = """import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from '@clerk/clerk-react';
import { User, List, MessageSquare, Bookmark, FileText, Save, Layout, Lock, Menu, X } from 'lucide-react';
import { cn } from './lib/utils';
import { SecurePdfMagicViewer } from './SecurePdfMagicViewer';
import { PdfMagicLinkGenerator } from './PdfMagicLinkGenerator';
import { AtheneumDashboard } from './AtheneumDashboard';
"""
content = re.sub(r"import \{ type ChangeEvent.*?import \{ PdfMagicLinkGenerator \} from '\./PdfMagicLinkGenerator';", imports, content, flags=re.DOTALL)

# 2. Add state for workspaceTab and mobileMenuOpen
state_addition = """  const [viewMode, setViewMode] = useState<'atheneum' | 'workspace'>('workspace');
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'intake' | 'recommendations' | 'chat' | 'sessions' | 'meetings'>('intake');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
"""
content = content.replace("  const [chatLoading, setChatLoading] = useState(false);", "  const [chatLoading, setChatLoading] = useState(false);\n" + state_addition)

# 3. Replace the workspace render block
workspace_layout = """      <SignedIn>
        {viewMode === 'atheneum' ? (
          <div className="relative">
            <AtheneumDashboard
              onOpenMagicLinkGenerator={() => setShowMagicModal(true)}
              onSwitchWorkspace={() => setViewMode('workspace')}
              onOpenHeuristics={() => setViewMode('workspace')}
            />
            <PdfMagicLinkGenerator
              isOpen={showMagicModal}
              onClose={() => setShowMagicModal(false)}
            />
          </div>
        ) : (
          <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">
            {/* Desktop Sidebar */}
            <aside className="w-64 border-r border-border bg-card flex-col hidden md:flex shrink-0">
              <div className="h-14 px-4 border-b border-border font-bold text-lg flex items-center gap-2 text-card-foreground">
                GradGuide <span className="text-primary text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10">Counselor</span>
              </div>
              
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                <button onClick={() => setWorkspaceTab('intake')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", workspaceTab === 'intake' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                  <User className="w-4 h-4"/> Profile Intake
                </button>
                <button onClick={() => setWorkspaceTab('recommendations')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", workspaceTab === 'recommendations' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                  <List className="w-4 h-4"/> Recommendations
                </button>
                <button onClick={() => setWorkspaceTab('chat')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", workspaceTab === 'chat' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                  <MessageSquare className="w-4 h-4"/> Natural Chat
                </button>
                <button onClick={() => setWorkspaceTab('sessions')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", workspaceTab === 'sessions' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                  <Bookmark className="w-4 h-4"/> Saved Sessions
                </button>
                <button onClick={() => setWorkspaceTab('meetings')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", workspaceTab === 'meetings' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                  <FileText className="w-4 h-4"/> Meeting Transcripts
                </button>
              </nav>

              <div className="p-4 border-t border-border space-y-3 bg-muted/30">
                <button onClick={() => void handleSaveSession()} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-secondary text-secondary-foreground rounded-md text-sm shadow-sm hover:opacity-90 font-medium border border-border transition-opacity">
                  <Save className="w-4 h-4"/> Save Session
                </button>
                <div className="space-y-1">
                  <button onClick={() => setViewMode('atheneum')} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground transition-colors">
                    <Layout className="w-4 h-4"/> The Atheneum
                  </button>
                  <button onClick={() => setShowMagicModal(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground transition-colors">
                    <Lock className="w-4 h-4"/> Magic Link PDF
                  </button>
                </div>
              </div>
            </aside>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-50 flex md:hidden">
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
                <aside className="relative w-3/4 max-w-sm bg-card border-r border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-left">
                  <div className="h-14 px-4 border-b border-border flex items-center justify-between text-card-foreground">
                    <span className="font-bold text-lg">GradGuide</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted-foreground"><X className="w-5 h-5"/></button>
                  </div>
                  <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    <button onClick={() => { setWorkspaceTab('intake'); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-md text-base transition-colors", workspaceTab === 'intake' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                      <User className="w-5 h-5"/> Profile Intake
                    </button>
                    <button onClick={() => { setWorkspaceTab('recommendations'); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-md text-base transition-colors", workspaceTab === 'recommendations' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                      <List className="w-5 h-5"/> Recommendations
                    </button>
                    <button onClick={() => { setWorkspaceTab('chat'); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-md text-base transition-colors", workspaceTab === 'chat' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                      <MessageSquare className="w-5 h-5"/> Natural Chat
                    </button>
                    <button onClick={() => { setWorkspaceTab('sessions'); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-md text-base transition-colors", workspaceTab === 'sessions' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                      <Bookmark className="w-5 h-5"/> Saved Sessions
                    </button>
                    <button onClick={() => { setWorkspaceTab('meetings'); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-md text-base transition-colors", workspaceTab === 'meetings' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground")}>
                      <FileText className="w-5 h-5"/> Meeting Transcripts
                    </button>
                  </nav>
                  <div className="p-4 border-t border-border space-y-3 bg-muted/30">
                    <button onClick={() => { void handleSaveSession(); setMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-secondary text-secondary-foreground rounded-md text-base shadow-sm hover:opacity-90 font-medium border border-border transition-opacity">
                      <Save className="w-5 h-5"/> Save Session
                    </button>
                  </div>
                </aside>
              </div>
            )}

            <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-muted/10">
              <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background shrink-0 shadow-sm">
                <div className="flex items-center gap-3 md:hidden">
                  <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-muted-foreground"><Menu className="w-5 h-5"/></button>
                  <span className="font-semibold text-sm">GradGuide</span>
                </div>
                <div className="hidden md:flex font-semibold text-sm tracking-wide uppercase text-muted-foreground">
                  {workspaceTab}
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => void handleSaveSession()} className="md:hidden flex items-center gap-1.5 text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md shadow-sm font-medium border border-border">
                    <Save className="w-3.5 h-3.5"/> Save
                  </button>
                  <UserButton />
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {appError && <div className="p-4 mb-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">{appError}</div>}
"""

def extract_panel(content, class_name):
    pattern = rf'(<section className="panel {class_name}">.*?</section>)'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1)
    return ""

form_panel = extract_panel(content, "form-panel")
results_panel = extract_panel(content, "results-panel")
chat_panel = extract_panel(content, "chat-panel")
session_panel = extract_panel(content, "session-panel")
documents_panel = extract_panel(content, "documents-panel")
document_viewer = extract_panel(content, "document-viewer")

# Use standard string replace!
workspace_panels = """
                <div className={workspaceTab === 'intake' ? 'block' : 'hidden'}>
                  _FORM_PANEL_
                </div>
                <div className={workspaceTab === 'recommendations' ? 'block space-y-6' : 'hidden'}>
                  _RESULTS_PANEL_
                </div>
                <div className={workspaceTab === 'chat' ? 'block' : 'hidden'}>
                  _CHAT_PANEL_
                </div>
                <div className={workspaceTab === 'sessions' ? 'block' : 'hidden'}>
                  _SESSION_PANEL_
                </div>
                <div className={workspaceTab === 'meetings' ? 'block space-y-6' : 'hidden'}>
                  _DOCUMENTS_PANEL_
                  {selectedDocument && (
                    _DOCUMENT_VIEWER_
                  )}
                </div>
              </div>
            </main>
            <PdfMagicLinkGenerator
              isOpen={showMagicModal}
              onClose={() => setShowMagicModal(false)}
            />
          </div>
        )}
"""

workspace_panels = workspace_panels.replace('_FORM_PANEL_', form_panel)
workspace_panels = workspace_panels.replace('_RESULTS_PANEL_', results_panel)
workspace_panels = workspace_panels.replace('_CHAT_PANEL_', chat_panel)
workspace_panels = workspace_panels.replace('_SESSION_PANEL_', session_panel)
workspace_panels = workspace_panels.replace('_DOCUMENTS_PANEL_', documents_panel)
workspace_panels = workspace_panels.replace('_DOCUMENT_VIEWER_', document_viewer)

# Splice it in
match = re.search(r'<SignedIn>\s*<div className="account-bar".*?</main>\s*</SignedIn>', content, re.DOTALL)
if match:
    old_block = match.group(0)
    new_block = workspace_layout + workspace_panels + "      </SignedIn>"
    content = content.replace(old_block, new_block)
else:
    print("Could not find <SignedIn> block!")

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("App.tsx patched successfully!")
