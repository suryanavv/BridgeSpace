import { FileShare } from "@/components/FileShare";
import { TextEditor } from "@/components/TextEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FileTextIcon, FileIcon } from "lucide-react";

const Index = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    return (
      <div className="container p-4 min-h-screen">
        <Tabs defaultValue="files" className="w-full h-[calc(100vh-2rem)]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileIcon className="h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileTextIcon className="h-4 w-4" />
              Text
            </TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="mt-4 h-[calc(100vh-8rem)]">
            <div className="h-full">
              <FileShare />
            </div>
          </TabsContent>
          <TabsContent value="text" className="mt-4 h-[calc(100vh-8rem)]">
            <div className="h-full">
              <TextEditor />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="container min-h-screen p-4">
      <div className="grid grid-cols-2 gap-4 h-[calc(100vh-2rem)]">
        <div className="h-full">
          <FileShare />
        </div>
        <div className="h-full">
          <TextEditor />
        </div>
      </div>
    </div>
  );
};

export default Index;