import { FileShare } from "@/components/FileShare";
import { TextEditor } from "@/components/TextEditor";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-5 py-10">
        <h1 className="text-3xl font-bold text-center mb-8">BridgeSpace</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
          <FileShare />
          <TextEditor />
        </div>
      </div>
    </div>
  );
};

export default Index;